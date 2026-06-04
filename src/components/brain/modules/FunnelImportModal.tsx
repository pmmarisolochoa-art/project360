import { useState } from 'react';
import { FileSpreadsheet, FileText, Workflow, Upload, Info } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from '@/store/useToastStore';
import { marked } from 'marked';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

/**
 * Modal para importar embudos desde fuentes externas.
 *
 * Por ahora:
 * - Asana: placeholder con instrucciones de exportación
 * - CSV/Excel: parseo básico de CSV (formato canónico documentado)
 * - Documento (.md/.docx): extracción de texto, el PM ajusta en el builder
 *
 * Cuando el archivo se procesa, llamamos onDraftReady con el texto plano
 * o el JSON parseado. El callback abre el CustomFunnelBuilder pre-llenado.
 */
export function FunnelImportModal({
  onCancel, onTextExtracted, onCsvParsed,
}: {
  onCancel: () => void;
  onTextExtracted: (text: string) => void;
  onCsvParsed: (rows: CsvRow[]) => void;
}) {
  const [tab, setTab] = useState<'asana' | 'csv' | 'doc'>('csv');

  return (
    <Modal open onClose={onCancel} size="lg" title={<span className="flex items-center gap-2">📥 Importar embudo</span>}>
      {/* Tabs */}
      <div className="surface p-2 inline-flex gap-1 mb-4">
        <TabBtn active={tab === 'csv'} onClick={() => setTab('csv')} icon={<FileSpreadsheet className="h-3.5 w-3.5" />}>
          CSV / Excel
        </TabBtn>
        <TabBtn active={tab === 'doc'} onClick={() => setTab('doc')} icon={<FileText className="h-3.5 w-3.5" />}>
          Documento (.md/.docx)
        </TabBtn>
        <TabBtn active={tab === 'asana'} onClick={() => setTab('asana')} icon={<Workflow className="h-3.5 w-3.5" />}>
          Asana
        </TabBtn>
      </div>

      {tab === 'csv' && <CsvTab onCancel={onCancel} onParsed={onCsvParsed} />}
      {tab === 'doc' && <DocTab onCancel={onCancel} onExtracted={onTextExtracted} />}
      {tab === 'asana' && <AsanaTab />}
    </Modal>
  );
}

function TabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-md transition inline-flex items-center gap-1.5 ${active ? 'bg-accent-violet/15 text-accent-violet font-semibold' : 'text-text-secondary hover:bg-bg-elevated'}`}
    >
      {icon}
      {children}
    </button>
  );
}

/* ─────────────── CSV / Excel ─────────────── */

export interface CsvRow {
  fase: string;
  faseColor?: string;
  faseDiaInicio?: number;
  faseDiaFin?: number;
  tareaTitulo: string;
  rol: string;
  diaInicio: number;
  diaFin: number;
  prioridad: 'P1' | 'P2' | 'P3';
  input?: string;
  output?: string;
}

function CsvTab({ onCancel, onParsed }: { onCancel: () => void; onParsed: (rows: CsvRow[]) => void }) {
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);
    try {
      const name = file.name.toLowerCase();
      let rows: CsvRow[];
      if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        // Excel binario — parseamos con SheetJS y convertimos la primera hoja
        // a CSV con separador coma, luego usamos el parser CSV normal.
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const firstSheet = wb.Sheets[wb.SheetNames[0]];
        if (!firstSheet) {
          setError('El archivo Excel está vacío o no se pudo leer.');
          return;
        }
        const csv = XLSX.utils.sheet_to_csv(firstSheet, { FS: ',' });
        rows = parseCsv(csv);
      } else {
        const text = await file.text();
        rows = parseCsv(text);
      }
      if (rows.length === 0) {
        setError('No se detectaron tareas válidas. Revisa el formato.');
        return;
      }
      onParsed(rows);
      toast.success(`${rows.length} tareas importadas — revisa antes de crear`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error procesando el archivo');
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border-subtle bg-bg-base/30 p-3 space-y-2">
        <div className="text-xs font-semibold text-text-primary inline-flex items-center gap-1">
          <Info className="h-3 w-3" /> Formato esperado (CSV con encabezado)
        </div>
        <pre className="text-[11px] text-text-secondary bg-bg-surface rounded p-2 overflow-x-auto">{`fase,faseColor,faseDiaInicio,faseDiaFin,tareaTitulo,rol,diaInicio,diaFin,prioridad,input,output
"FASE 1 — Setup",#6366F1,1,7,"Configurar pixel Meta",media_buyer,1,3,P1,"Acceso BM","Pixel verificado"
"FASE 1 — Setup",,,,"Crear landing",funnel_builder,3,7,P2,"Diseño aprobado","URL activa"`}</pre>
        <div className="text-[10px] text-text-muted">
          Roles válidos: strategist · media_buyer · copywriter · designer · community · funnel_builder · editor · closer · onboarding
        </div>
        <div className="text-[10px] text-text-muted">
          ✅ Acepta <strong>.xlsx, .xls, .csv y .tsv</strong> directamente — no necesitas convertir.
          Auto-detecta separador (`,`, `;`, TAB).
        </div>
      </div>

      <label className="block">
        <input
          type="file"
          accept=".csv,.tsv,.txt,.xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = '';
          }}
          id="csv-upload"
        />
        <Button
          leftIcon={<Upload className="h-3.5 w-3.5" />}
          onClick={() => document.getElementById('csv-upload')?.click()}
        >
          Subir archivo (.csv o .xlsx)
        </Button>
      </label>

      {error && (
        <div className="text-xs text-status-danger whitespace-pre-line rounded-md border border-status-danger/30 bg-status-danger/5 p-2">
          {error}
        </div>
      )}

      <div className="flex justify-end pt-2 border-t border-border-subtle">
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}

/* ─────────────── Documento ─────────────── */

function DocTab({ onCancel, onExtracted }: { onCancel: () => void; onExtracted: (text: string) => void }) {
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);
    try {
      const name = file.name.toLowerCase();
      let plain = '';
      if (name.endsWith('.md') || name.endsWith('.markdown')) {
        const raw = await file.text();
        const html = await marked.parse(raw);
        plain = String(html).replace(/<[^>]+>/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
      } else if (name.endsWith('.docx')) {
        const buf = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer: buf });
        plain = result.value.trim();
      } else {
        setError('Solo .md o .docx');
        return;
      }
      if (!plain) {
        setError('No se extrajo texto del documento');
        return;
      }
      onExtracted(plain);
      toast.success('Documento extraído — revisa en el builder');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error procesando documento');
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border-subtle bg-bg-base/30 p-3 text-xs text-text-secondary">
        Sube un documento <strong>.md</strong> o <strong>.docx</strong> con la estructura de tu embudo.
        El texto se inserta en las notas del builder y tú lo conviertes en fases y tareas a mano.
        Más adelante esto se hará con IA.
      </div>

      <label className="block">
        <input
          type="file"
          accept=".md,.markdown,.docx"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = '';
          }}
          id="doc-upload"
        />
        <Button
          leftIcon={<Upload className="h-3.5 w-3.5" />}
          onClick={() => document.getElementById('doc-upload')?.click()}
        >
          Subir .md o .docx
        </Button>
      </label>

      {error && (
        <div className="text-xs text-status-danger whitespace-pre-line rounded-md border border-status-danger/30 bg-status-danger/5 p-2">
          {error}
        </div>
      )}

      <div className="flex justify-end pt-2 border-t border-border-subtle">
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}

/* ─────────────── Asana ─────────────── */

function AsanaTab() {
  const [apiToken, setApiToken] = useState('');

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-status-warning/30 bg-status-warning/5 p-3 text-xs text-text-secondary">
        <div className="font-semibold text-status-warning mb-1">⏳ Integración Asana — próximamente</div>
        Por ahora, exporta tu proyecto desde Asana como CSV y úsalo en la pestaña <strong>CSV / Excel</strong>:
        <ol className="list-decimal pl-5 mt-2 space-y-0.5">
          <li>En Asana → tu proyecto → menú ··· → <strong>Export</strong></li>
          <li>Selecciona <strong>CSV</strong></li>
          <li>Vuelve aquí → pestaña CSV/Excel → sube el archivo</li>
        </ol>
      </div>

      <div>
        <span className="text-[10px] uppercase tracking-wider text-text-muted mb-1 block">Asana Personal Access Token (cuando esté lista la integración)</span>
        <Input value={apiToken} onChange={(e) => setApiToken(e.target.value)} placeholder="0/abcd1234..." disabled />
        <div className="text-[10px] text-text-muted mt-1">Se guardará cifrado por agencia. Función deshabilitada por ahora.</div>
      </div>
    </div>
  );
}

/* ─────────────── CSV parser ─────────────── */

function parseCsv(text: string): CsvRow[] {
  // Quita BOM (Excel UTF-8 lo agrega) — sin esto el primer header queda con ﻿.
  const clean = text.replace(/^﻿/, '');

  // Auto-detecta separador. Excel en locales ES/FR/DE exporta con `;`,
  // EN/US con `,`. Algunos sistemas con `\t` (TSV). Conteo en la primera línea.
  const firstLine = clean.split(/\r?\n/)[0] ?? '';
  const counts = { ',': (firstLine.match(/,/g) ?? []).length,
                   ';': (firstLine.match(/;/g) ?? []).length,
                   '\t': (firstLine.match(/\t/g) ?? []).length };
  const sep: ',' | ';' | '\t' =
    counts[';'] > counts[','] && counts[';'] >= counts['\t'] ? ';' :
    counts['\t'] > counts[','] ? '\t' : ',';

  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0], sep).map((h) => h.trim().toLowerCase());

  const required = ['fase', 'tareatitulo', 'rol', 'diainicio', 'diafin', 'prioridad'];
  const missing = required.filter((r) => !headers.includes(r));
  if (missing.length > 0) {
    throw new Error(
      `Faltan columnas requeridas: ${missing.join(', ')}.\n` +
      `Separador detectado: "${sep === '\t' ? 'TAB' : sep}". ` +
      `Encabezados leídos: ${headers.join(' | ')}`,
    );
  }

  const idx = (key: string) => headers.indexOf(key.toLowerCase());

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i], sep);
    if (cells.length === 0) continue;
    const prio = (cells[idx('prioridad')] || 'P2').toUpperCase();
    rows.push({
      fase: cells[idx('fase')] || 'Sin fase',
      faseColor: cells[idx('fasecolor')] || undefined,
      faseDiaInicio: cells[idx('fasediainicio')] ? parseInt(cells[idx('fasediainicio')], 10) : undefined,
      faseDiaFin: cells[idx('fasediafin')] ? parseInt(cells[idx('fasediafin')], 10) : undefined,
      tareaTitulo: cells[idx('tareatitulo')] || 'Sin título',
      rol: cells[idx('rol')] || 'strategist',
      diaInicio: parseInt(cells[idx('diainicio')] || '1', 10),
      diaFin: parseInt(cells[idx('diafin')] || '1', 10),
      prioridad: (['P1', 'P2', 'P3'].includes(prio) ? prio : 'P2') as 'P1' | 'P2' | 'P3',
      input: cells[idx('input')] || undefined,
      output: cells[idx('output')] || undefined,
    });
  }
  return rows;
}

function splitCsvLine(line: string, sep: string = ','): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === sep && !inQuotes) {
      cells.push(current);
      current = '';
    } else {
      current += c;
    }
  }
  cells.push(current);
  return cells;
}

export { parseCsv };
