import { useCallback, useEffect, useRef, useState } from 'react';
import { useUIDrawerStore } from '@/store/useUIDrawerStore';
import { motion } from 'framer-motion';
import {
  X, Copy, ExternalLink, Sparkles, Trash2, CheckCircle2, Upload, FileText, Mic, ListChecks, Paperclip, FileDown, Brain,
} from 'lucide-react';
import { exportMeetingReport } from '@/services/reportsPdf';
import { marked } from 'marked';
import mammoth from 'mammoth';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Meeting, MeetingType } from '@/types/meeting';
import type { Task } from '@/types/task';
import { useClientStore } from '@/store/useClientStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Badge } from '@/components/ui/Badge';
import { generateMeetingAgenda, extractTasksFromNotes, generateRopreFromTranscription, type ExtractedTask } from '@/services/claudeApi';
import { useRopreStore } from '@/store/useRopreStore';
import type { RopreItem } from '@/types/ropre';
import { ROLE_DEFS } from '@/types/team';
import { RopreInlineEditor } from './RopreInlineEditor';
import { WeeklyPlanningGrid } from './WeeklyPlanningGrid';
import { toast } from '@/store/useToastStore';
import { withAlpha } from '@/utils/colorGenerator';
import { genId } from '@/utils/id';

const TYPE_LABEL: Record<MeetingType, string> = {
  kickoff: 'Kickoff', weekly_metrics: 'Revisión semanal', content_strategy: 'Estrategia de contenido',
  ads_review: 'Revisión de ADS', monthly_closing: 'Cierre mensual', crisis: 'Crisis / Urgente',
  weekly_planning: 'Planeación semanal', ropre_strategy: 'Estrategia ROPRE & Entregables',
};

export function MeetingDrawer({ meeting, onClose }: { meeting: Meeting; onClose: () => void }) {
  const client = useClientStore((s) => s.clients.find((c) => c.id === meeting.clientId));
  const updateMeeting = useClientStore((s) => s.updateMeeting);
  const deleteMeeting = useClientStore((s) => s.deleteMeeting);
  const tasksByClient = useClientStore((s) => s.tasks);
  const allMeetings = useClientStore((s) => s.meetings);
  const addTask = useClientStore((s) => s.addTask);
  const autoGenAgenda = useUIDrawerStore((s) => s.autoGenAgenda);
  const consumeAutoGen = useUIDrawerStore((s) => s.consumeAutoGen);
  const accent = client?.primaryColor ?? '#8B5CF6';

  const [videoLink, setVideoLink] = useState(meeting.videoCallLink ?? '');
  const [agenda, setAgenda] = useState(meeting.agenda ?? '');
  const [notes, setNotes] = useState(meeting.notes ?? '');
  const [recordingUrl, setRecordingUrl] = useState(meeting.recordingUrl ?? '');
  const [generating, setGenerating] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [generatingRopre, setGeneratingRopre] = useState(false);
  const [extractedDraft, setExtractedDraft] = useState<ExtractedTask[]>(meeting.extractedTasks ?? []);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saveIndicator, setSaveIndicator] = useState<string>('');
  const initialNotes = useRef(meeting.notes ?? '');

  // Auto-save notas con debounce 3s
  useEffect(() => {
    if (notes === initialNotes.current) return;
    const t = setTimeout(() => {
      updateMeeting(meeting.id, { notes, notesUpdatedAt: new Date().toISOString() });
      initialNotes.current = notes;
      setSaveIndicator('Guardado automático ✓');
      setTimeout(() => setSaveIndicator(''), 2000);
    }, 3000);
    return () => clearTimeout(t);
  }, [notes, meeting.id, updateMeeting]);

  const generateAgenda = useCallback(async () => {
    if (!client) return;
    setGenerating(true);
    try {
      const pendingTasksList = tasksByClient.filter((t) => t.clientId === client.id && t.status !== 'completed');
      const hasAds = Object.values(client.adsConnected).some(Boolean);

      // ─── Contexto extendido: cerebro IA ───
      const brain = client.aiBrainData ?? {};
      const brainSummary = (brain as { executiveSummary?: string }).executiveSummary;
      const brainOffer = (brain as { irresistibleOffer?: string }).irresistibleOffer;
      const personas = (brain as { buyerPersonas?: Array<{ name: string; description: string }> }).buyerPersonas;
      const brainPersonas = personas && personas.length > 0
        ? personas.slice(0, 3).map((p) => `${p.name}: ${p.description}`).join(' | ')
        : undefined;

      // ─── Contexto extendido: últimas 3 reuniones del mismo cliente, anteriores a esta ───
      const recentMeetings = allMeetings
        .filter((m) => m.clientId === client.id && m.id !== meeting.id && new Date(m.scheduledAt) < new Date(meeting.scheduledAt))
        .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
        .slice(0, 3)
        .map((m) => ({
          type: m.type,
          scheduledAt: m.scheduledAt,
          summary: m.summary,
          notes: m.notes,
        }));

      // ─── Tareas pendientes con detalle (top 10 ordenadas por urgencia) ───
      const now = Date.now();
      const pendingTasks = pendingTasksList
        .map((t) => {
          const dueInDays = Math.round((new Date(t.dueDate).getTime() - now) / (1000 * 60 * 60 * 24));
          return {
            title: t.title,
            priority: t.priority,
            assignedTo: t.assignedTo,
            dueInDays,
          };
        })
        .sort((a, b) => {
          // Vencidas y P1 primero
          const aOverdue = a.dueInDays < 0 ? 0 : 1;
          const bOverdue = b.dueInDays < 0 ? 0 : 1;
          if (aOverdue !== bOverdue) return aOverdue - bOverdue;
          const pri: Record<string, number> = { P1: 0, P2: 1, P3: 2 };
          return (pri[a.priority] ?? 3) - (pri[b.priority] ?? 3);
        })
        .slice(0, 10);

      // ─── Métricas ADS: usamos lo que ya hay cacheado en client.metrics (sin nuevo fetch) ───
      const cm = (client.metrics ?? {}) as { roas?: number | null; invertedThisMonth?: number };
      const adsMetrics = hasAds && (cm.roas != null || cm.invertedThisMonth != null)
        ? {
            roas: cm.roas ?? undefined,
            spend7d: cm.invertedThisMonth != null ? cm.invertedThisMonth / 4 : undefined, // aproximación
            notes: undefined,
          }
        : undefined;

      const result = await generateMeetingAgenda({
        clientName: client.name,
        industry: client.industry,
        meetingType: meeting.type,
        pendingTasksCount: pendingTasksList.length,
        hasAdsData: hasAds,
        notes: notes || undefined,
        brainSummary,
        brainOffer,
        brainPersonas,
        recentMeetings: recentMeetings.length > 0 ? recentMeetings : undefined,
        pendingTasks: pendingTasks.length > 0 ? pendingTasks : undefined,
        adsMetrics,
      });
      setAgenda(result);
      updateMeeting(meeting.id, { agenda: result });
    } finally {
      setGenerating(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, meeting.id, meeting.type, meeting.scheduledAt, notes, allMeetings, tasksByClient]);

  // Auto-generación: si llegamos con autoGenAgenda=true Y no hay agenda ya escrita, generamos.
  // consumeAutoGen apaga el flag para evitar re-disparos.
  const autoGenAttemptedRef = useRef(false);
  useEffect(() => {
    if (!autoGenAgenda || autoGenAttemptedRef.current) return;
    if (agenda.trim().length > 0) {
      consumeAutoGen();
      return;
    }
    autoGenAttemptedRef.current = true;
    consumeAutoGen();
    void generateAgenda();
  }, [autoGenAgenda, agenda, generateAgenda, consumeAutoGen]);

  // Sección 1 — Subir resumen sin consumir tokens.
  // Parsea .md/.docx 100% en cliente y pega el texto plano en las notas.
  // La IA solo se llama cuando el usuario hace click en "Extraer tareas".
  const handleResumeUpload = async (file: File) => {
    try {
      const name = file.name.toLowerCase();
      let plainText = '';
      if (name.endsWith('.md') || name.endsWith('.markdown')) {
        const raw = await file.text();
        const html = await marked.parse(raw);
        plainText = String(html)
          .replace(/<[^>]+>/g, '\n')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
      } else if (name.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        plainText = result.value.trim();
      } else {
        toast.error('Formato no soportado. Usa .md o .docx');
        return;
      }
      if (!plainText) {
        toast.error('No se pudo extraer texto del archivo');
        return;
      }
      // Prepend al campo de notas con separador para no perder lo que ya había.
      const next = notes.trim().length > 0
        ? `${plainText}\n\n— Notas previas —\n${notes}`
        : plainText;
      setNotes(next);
      setUploadedFileName(file.name);
      toast.success('Resumen cargado correctamente — sin consumo de tokens ✓');
    } catch (e) {
      console.warn('[resume upload]', e);
      toast.error('Error al procesar el archivo');
    }
  };

  const runExtractTasks = async () => {
    if (!client) return;
    const sourceText = `${notes}\n${agenda}`.trim();
    if (sourceText.length < 10) {
      toast.error('Escribe notas o agenda primero para extraer tareas');
      return;
    }
    setExtracting(true);
    try {
      const result = await extractTasksFromNotes({
        clientName: client.name,
        industry: client.industry,
        meetingType: meeting.type,
        notes,
        agenda,
        availableRoles: ROLE_DEFS.map((r) => r.slug),
      });
      if (result.length === 0) {
        toast.info('No se detectaron tareas accionables en las notas');
        return;
      }
      setExtractedDraft(result);
      updateMeeting(meeting.id, { extractedTasks: result });
      toast.success(`${result.length} tarea${result.length === 1 ? '' : 's'} extraída${result.length === 1 ? '' : 's'} — revisa y confirma`);
    } finally {
      setExtracting(false);
    }
  };

  const runGenerateRopre = async () => {
    if (!client) return;
    const source = (meeting.transcription && meeting.transcription.trim().length > 50)
      ? meeting.transcription
      : `${notes}\n\n${agenda}`.trim();
    if (source.length < 50) {
      toast.error('Necesitas transcripción, notas o agenda con contenido para generar el ROPRE');
      return;
    }
    setGeneratingRopre(true);
    try {
      const ropre = await generateRopreFromTranscription({
        clientName: client.name,
        industry: client.industry,
        meetingType: meeting.type,
        transcription: source,
        availableRoles: ROLE_DEFS.map((r) => r.slug),
      });
      const now = new Date().toISOString();
      const addRopre = useRopreStore.getState().add;
      let created = 0;
      const push = (item: RopreItem) => { addRopre(item); created++; };
      for (const r of ropre.results) {
        push({ id: genId(), clientId: client.id, type: 'result', title: r.title, description: r.description, createdAt: now, lastEditedInMeetingId: meeting.id, lastEditedAt: now });
      }
      for (const o of ropre.objectives) {
        push({ id: genId(), clientId: client.id, type: 'objective', title: o.title, targetValue: o.targetValue, createdAt: now, lastEditedInMeetingId: meeting.id, lastEditedAt: now });
      }
      for (const p of ropre.premises) {
        push({ id: genId(), clientId: client.id, type: 'premise', title: p.title, description: p.description, createdAt: now, lastEditedInMeetingId: meeting.id, lastEditedAt: now });
      }
      for (const rk of ropre.risks) {
        push({ id: genId(), clientId: client.id, type: 'risk', title: rk.title, riskLevel: rk.riskLevel, mitigation: rk.mitigation, createdAt: now, lastEditedInMeetingId: meeting.id, lastEditedAt: now });
      }
      for (const d of ropre.deliverables) {
        const dueDays = d.dueInDays ?? 7;
        push({
          id: genId(), clientId: client.id, type: 'deliverable', title: d.title,
          responsible: d.responsible, status: 'todo',
          dueDate: new Date(Date.now() + dueDays * 86400000).toISOString(),
          createdAt: now, lastEditedInMeetingId: meeting.id, lastEditedAt: now,
        });
      }
      if (created === 0) {
        toast.info('No se detectaron items ROPRE en la transcripción');
      } else {
        toast.success(`${created} items ROPRE creados — revísalos en el módulo ROPRE del cliente`);
      }
    } finally {
      setGeneratingRopre(false);
    }
  };

  const markDone = async () => {
    // Si hay notas significativas, auto-extraer tareas y crearlas SIN confirmación manual.
    // El usuario puede borrarlas después si alguna no le sirve. Trade-off: velocidad > control.
    let extractedCount = 0;
    if (client && notes.trim().length >= 20) {
      try {
        const result = await extractTasksFromNotes({
          clientName: client.name,
          industry: client.industry,
          meetingType: meeting.type,
          notes,
          agenda,
          availableRoles: ROLE_DEFS.map((r) => r.slug),
        });
        for (const t of result) {
          const task: Task = {
            id: genId(),
            clientId: meeting.clientId,
            title: t.title,
            status: 'pending',
            priority: t.priority ?? 'P2',
            assignedTo: t.responsibleRole,
            dueDate: new Date(Date.now() + t.dueInDays * 86400000).toISOString(),
            isDelayed: false,
            delayDays: 0,
            moduleTag: 'meeting',
            tag: t.tag ?? 'meeting',
            createdAt: new Date().toISOString(),
          };
          addTask(task);
          extractedCount++;
        }
      } catch (e) {
        console.warn('[markDone] auto-extracción falló', e);
      }
    }

    updateMeeting(meeting.id, { completed: true });
    if (extractedCount > 0) {
      toast.success(`Reunión realizada · ${extractedCount} tarea${extractedCount === 1 ? '' : 's'} creada${extractedCount === 1 ? '' : 's'} automáticamente`);
    } else {
      toast.success('Reunión marcada como realizada');
    }
    onClose();
  };

  const cancelMeeting = () => {
    if (!confirm('¿Cancelar esta reunión? La acción no se puede deshacer.')) return;
    deleteMeeting(meeting.id);
    toast.success('Reunión cancelada');
    onClose();
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-bg-base/70 backdrop-blur-sm"
      />
      <motion.aside
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'tween', duration: 0.25 }}
        className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-xl bg-bg-surface border-l border-border-default flex flex-col"
      >
        <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border-subtle">
          <div className="min-w-0">
            {client && (
              <Badge tone="neutral" className="mb-1.5" >
                <span className="h-1.5 w-1.5 rounded-full inline-block mr-1" style={{ background: client.primaryColor }} />
                {client.name}
              </Badge>
            )}
            <h2 className="heading text-lg font-bold leading-tight">{meeting.title}</h2>
            {meeting.completed && <Badge tone="success" className="mt-1"><CheckCircle2 className="h-3 w-3" /> Completada</Badge>}
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-elevated" aria-label="Cerrar">
            <X className="h-4 w-4 mx-auto" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Detalles */}
          <section>
            <SectionTitle text="📅 Detalles" accent={accent} />
            <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <Field label="Fecha" value={format(parseISO(meeting.scheduledAt), "EEEE d 'de' MMMM, yyyy", { locale: es })} />
              <Field label="Hora" value={format(parseISO(meeting.scheduledAt), 'HH:mm')} />
              <Field label="Duración" value={`${meeting.durationMin} min`} />
              <Field label="Tipo" value={TYPE_LABEL[meeting.type]} />
            </dl>
            <div className="mt-3">
              <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Participantes</div>
              <div className="flex flex-wrap gap-1.5">
                {meeting.participants.map((p, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-bg-elevated border border-border-subtle px-2 py-1 text-[11px]">
                    <span className="h-5 w-5 rounded-full bg-gradient-accent text-white flex items-center justify-center text-[9px] font-semibold">
                      {p.name[0]?.toUpperCase()}
                    </span>
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/* Link videollamada */}
          <section>
            <SectionTitle text="🔗 Link de videollamada" accent={accent} />
            <Input
              className="mt-2"
              placeholder="https://meet.google.com/…"
              value={videoLink}
              onChange={(e) => setVideoLink(e.target.value)}
              onBlur={() => updateMeeting(meeting.id, { videoCallLink: videoLink || undefined })}
            />
            <div className="mt-2 flex gap-2">
              <Button
                size="sm" variant="secondary" leftIcon={<Copy className="h-3.5 w-3.5" />}
                disabled={!videoLink}
                onClick={() => { navigator.clipboard.writeText(videoLink); toast.success('Link copiado'); }}
              >Copiar</Button>
              <Button
                size="sm" variant="secondary" leftIcon={<ExternalLink className="h-3.5 w-3.5" />}
                disabled={!videoLink}
                onClick={() => window.open(videoLink, '_blank')}
              >Abrir</Button>
            </div>
          </section>

          {/* Agenda */}
          <section>
            <div className="flex items-center justify-between">
              <SectionTitle text="📋 Agenda" accent={accent} />
              <Button size="sm" variant="ghost" leftIcon={<Sparkles className="h-3.5 w-3.5" />} loading={generating} onClick={generateAgenda}>
                Generar con IA
              </Button>
            </div>
            <Textarea
              className="mt-2"
              rows={6}
              placeholder="Estructura de la reunión…"
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              onBlur={() => updateMeeting(meeting.id, { agenda })}
            />
          </section>

          {/* ROPRE inline editor — solo para meeting.type === 'ropre_strategy' */}
          {meeting.type === 'ropre_strategy' && client && (
            <section>
              <RopreInlineEditor clientId={client.id} meetingId={meeting.id} accent={accent} />
            </section>
          )}

          {/* Grid Persona × Día — solo para meeting.type === 'weekly_planning' */}
          {meeting.type === 'weekly_planning' && client && (
            <section>
              <WeeklyPlanningGrid clientId={client.id} weekAnchor={meeting.scheduledAt} accent={accent} />
            </section>
          )}

          {/* Notas con auto-save */}
          <section>
            <div className="flex items-center justify-between">
              <SectionTitle text="📝 Notas de la reunión" accent={accent} />
              {saveIndicator && <span className="text-[10px] text-status-success">{saveIndicator}</span>}
            </div>
            <Textarea
              className="mt-2"
              rows={8}
              placeholder="Escribe notas aquí — se guardan automáticamente cada 3s…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            {uploadedFileName && (
              <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-text-secondary rounded-md border border-border-subtle bg-bg-base/40 px-2 py-1">
                <FileText className="h-3 w-3" /> Archivo cargado: <span className="font-medium text-text-primary">{uploadedFileName}</span>
              </div>
            )}
          </section>

          {/* Grabación */}
          <section>
            <SectionTitle text="🎙️ Grabación y transcripción" accent={accent} />
            <Input
              className="mt-2"
              placeholder="URL externa (Drive, Loom…)"
              value={recordingUrl}
              onChange={(e) => setRecordingUrl(e.target.value)}
              onBlur={() => updateMeeting(meeting.id, { recordingUrl: recordingUrl || undefined })}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" leftIcon={<Paperclip className="h-3.5 w-3.5" />}
                onClick={() => fileInputRef.current?.click()}>Subir resumen (.md o .docx)</Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".md,.markdown,.docx"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleResumeUpload(f);
                  e.target.value = '';
                }}
              />
              <Button size="sm" variant="secondary" leftIcon={<Upload className="h-3.5 w-3.5" />}
                onClick={() => toast.info('Upload de audio/video disponible próximamente')}>Subir archivo</Button>
              <Button size="sm" variant="secondary" leftIcon={<Mic className="h-3.5 w-3.5" />}
                onClick={() => toast.info('Transcripción disponible próximamente')}>Transcribir con IA</Button>
              <Button size="sm" variant="secondary" leftIcon={<ListChecks className="h-3.5 w-3.5" />}
                loading={extracting} onClick={runExtractTasks}>Extraer tareas</Button>
              <Button size="sm" variant="secondary" leftIcon={<Brain className="h-3.5 w-3.5" />}
                loading={generatingRopre} onClick={runGenerateRopre}>Generar ROPRE</Button>
            </div>
            <p className="mt-1.5 text-[10px] text-text-muted leading-relaxed">
              <Brain className="inline h-2.5 w-2.5 mr-0.5" /> Genera Resultados · Objetivos · Primicias · Riesgos · Entregables
              desde la transcripción o notas. Los items se crean en el módulo ROPRE del cliente.
            </p>
          </section>

          {/* Tareas extraídas */}
          {extractedDraft.length > 0 && (
            <section>
              <SectionTitle text="✅ Tareas detectadas — revisa y confirma" accent={accent} />
              <ExtractedTasksList
                tasks={extractedDraft}
                onConfirm={(selected) => {
                  for (const t of selected) {
                    const task: Task = {
                      id: genId(),
                      clientId: meeting.clientId,
                      title: t.title,
                      status: 'pending',
                      priority: t.priority ?? 'P2',
                      assignedTo: t.responsibleRole,
                      dueDate: new Date(Date.now() + t.dueInDays * 86400000).toISOString(),
                      isDelayed: false,
                      delayDays: 0,
                      moduleTag: 'meeting',
                      tag: t.tag ?? 'meeting',
                      origin: undefined,
                      createdAt: new Date().toISOString(),
                    };
                    addTask(task);
                  }
                  setExtractedDraft([]);
                  updateMeeting(meeting.id, { extractedTasks: [] });
                  toast.success(`${selected.length} tarea${selected.length === 1 ? '' : 's'} creada${selected.length === 1 ? '' : 's'} en el módulo Tareas`);
                }}
              />
            </section>
          )}
        </div>

        <footer className="border-t border-border-subtle px-5 py-3 flex items-center justify-between gap-2"
          style={{ background: withAlpha(accent, 0.04) }}
        >
          <Button variant="danger" size="sm" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={cancelMeeting}>
            Cancelar reunión
          </Button>
          <div className="flex items-center gap-2">
            {client && (
              <Button
                size="sm"
                variant="secondary"
                leftIcon={<FileDown className="h-3.5 w-3.5" />}
                onClick={() => {
                  try {
                    exportMeetingReport({ client, meeting });
                    toast.success('Reporte de reunión generado');
                  } catch (e) {
                    console.warn('[meetingPdf]', e);
                    toast.error('No se pudo generar el reporte');
                  }
                }}
              >
                PDF
              </Button>
            )}
            {!meeting.completed && (
              <Button size="sm" leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />} onClick={markDone}>
                Marcar como realizada
              </Button>
            )}
          </div>
        </footer>
      </motion.aside>
    </>
  );
}

function SectionTitle({ text, accent }: { text: string; accent: string }) {
  return (
    <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: accent }}>
      {text}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border-subtle bg-bg-base/30 p-2">
      <dt className="text-[10px] uppercase tracking-wider text-text-muted">{label}</dt>
      <dd className="text-xs text-text-primary mt-0.5">{value}</dd>
    </div>
  );
}

function ExtractedTasksList({
  tasks, onConfirm,
}: {
  tasks: ExtractedTask[];
  onConfirm: (selected: ExtractedTask[]) => void;
}) {
  const [checked, setChecked] = useState<boolean[]>(tasks.map(() => true));
  const selectedCount = checked.filter(Boolean).length;
  const priorityTone: Record<string, 'danger' | 'warning' | 'neutral'> = { P1: 'danger', P2: 'warning', P3: 'neutral' };
  return (
    <div className="mt-2 space-y-1.5">
      {tasks.map((t, i) => (
        <label key={i} className="flex items-start gap-2 rounded-md border border-border-subtle bg-bg-base/30 px-3 py-2 cursor-pointer">
          <input type="checkbox" checked={checked[i]} onChange={() => {
            const next = [...checked]; next[i] = !next[i]; setChecked(next);
          }} className="h-3.5 w-3.5 mt-1 accent-accent-violet" />
          <FileText className="h-3.5 w-3.5 text-text-muted shrink-0 mt-1" />
          <div className="flex-1 min-w-0">
            <div className="text-xs text-text-primary">{t.title}</div>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              {t.priority && <Badge tone={priorityTone[t.priority] ?? 'neutral'}>{t.priority}</Badge>}
              <Badge tone="neutral">{t.responsibleRole}</Badge>
              {t.tag && t.tag !== 'other' && <Badge tone="neutral">{t.tag}</Badge>}
              <span className="text-[10px] text-text-muted">+{t.dueInDays}d</span>
            </div>
          </div>
        </label>
      ))}
      <Button size="sm" disabled={selectedCount === 0} onClick={() => onConfirm(tasks.filter((_, i) => checked[i]))}>
        Crear {selectedCount} tarea{selectedCount === 1 ? '' : 's'}
      </Button>
    </div>
  );
}
