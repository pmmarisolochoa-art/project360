import { useMemo, useState } from 'react';
import { Download, ClipboardCheck, Trash2, Sparkles } from 'lucide-react';
import { ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { useSopStore } from '@/store/useSopStore';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import {
  SOP_BLOCKS, SOP_QUESTIONS, type SopAssessment,
} from '@/types/viability';
import { exportSopReport } from '@/services/sopPdf';
import { toast } from '@/store/useToastStore';

export function SopAgentPage() {
  const assessments = useSopStore((s) => s.assessments);
  const save = useSopStore((s) => s.save);
  const remove = useSopStore((s) => s.remove);
  const setDecision = useSopStore((s) => s.setDecision);

  const [prospectName, setProspectName] = useState('');
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState<SopAssessment | null>(null);

  // Functional update — necesario si llegan varias respuestas en la misma tick (batching).
  const setAns = (qid: number, v: number) => setAnswers((prev) => ({ ...prev, [qid]: v }));

  const allAnswered = SOP_QUESTIONS.every((q) => answers[q.id] !== undefined);

  const calc = useMemo<{ blockScores: Record<'A' | 'B' | 'C' | 'D' | 'E', number>; total: number }>(() => {
    const blockScores: Record<'A' | 'B' | 'C' | 'D' | 'E', number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
    let total = 0;
    for (const q of SOP_QUESTIONS) {
      const v = answers[q.id] ?? 0;
      blockScores[q.block] += v;
      total += v;
    }
    return { blockScores, total };
  }, [answers]);

  const verdictFor = (score: number): SopAssessment['verdict'] =>
    score >= 80 ? 'ideal' : score >= 60 ? 'viable' : score >= 40 ? 'risky' : 'reject';

  const submit = () => {
    if (!prospectName.trim()) { toast.error('Nombre del prospecto requerido'); return; }
    if (!allAnswered) { toast.error('Responde todas las 25 preguntas'); return; }
    const a: SopAssessment = {
      id: `sop_${Math.random().toString(36).slice(2, 8)}`,
      prospectName,
      createdAt: new Date().toISOString(),
      answers: Object.entries(answers).map(([k, v]) => ({ questionId: Number(k), value: v })),
      score: calc.total,
      blockScores: calc.blockScores,
      verdict: verdictFor(calc.total),
    };
    save(a);
    setSubmitted(a);
    toast.success('Análisis guardado');
  };

  const reset = () => { setSubmitted(null); setAnswers({}); setProspectName(''); };

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-4">
      <header className="space-y-1">
        <div className="text-[11px] uppercase tracking-[0.22em] text-text-muted">Agente SOP</div>
        <h1 className="heading text-3xl font-bold gradient-text">Análisis de Viabilidad de Cliente</h1>
        <p className="text-sm text-text-secondary">Proceso SOP para evaluar si trabajar con un nuevo cliente</p>
      </header>

      {!submitted ? (
        <SopForm
          prospectName={prospectName} setProspectName={setProspectName}
          answers={answers} setAns={setAns} calc={calc}
          submit={submit}
        />
      ) : (
        <SopResult assessment={submitted} onReset={reset} />
      )}

      {assessments.length > 0 && (
        <section className="surface p-5">
          <h2 className="heading text-base font-bold mb-3">Historial de análisis</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-text-muted border-b border-border-subtle">
                  <th className="py-2 pr-3">Prospecto</th>
                  <th className="py-2 pr-3">Fecha</th>
                  <th className="py-2 pr-3">Puntaje</th>
                  <th className="py-2 pr-3">Resultado</th>
                  <th className="py-2 pr-3">Decisión</th>
                  <th className="py-2 pr-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {assessments.map((a) => (
                  <tr key={a.id} className="border-b border-border-subtle/30">
                    <td className="py-2.5 pr-3 text-text-primary">{a.prospectName}</td>
                    <td className="py-2.5 pr-3 text-xs text-text-muted">{new Date(a.createdAt).toLocaleString('es')}</td>
                    <td className="py-2.5 pr-3 font-semibold">{a.score}/100</td>
                    <td className="py-2.5 pr-3"><VerdictBadge verdict={a.verdict} /></td>
                    <td className="py-2.5 pr-3">
                      <input
                        defaultValue={a.decision ?? ''}
                        onBlur={(e) => setDecision(a.id, e.target.value)}
                        placeholder="Tomada / pendiente"
                        className="bg-bg-elevated/40 border border-border-subtle rounded-md px-2 py-1 text-xs text-text-primary outline-none w-full"
                      />
                    </td>
                    <td className="py-2.5 pr-3 flex items-center gap-1">
                      <button onClick={() => exportSopReport(a)} className="h-7 w-7 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-elevated inline-flex items-center justify-center">
                        <Download className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => { remove(a.id); toast.success('Eliminado'); }} className="h-7 w-7 rounded-md text-text-muted hover:text-status-danger hover:bg-bg-elevated">
                        <Trash2 className="h-3.5 w-3.5 mx-auto" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function SopForm({
  prospectName, setProspectName, answers, setAns, calc, submit,
}: {
  prospectName: string;
  setProspectName: (v: string) => void;
  answers: Record<number, number>;
  setAns: (qid: number, v: number) => void;
  calc: { blockScores: Record<'A' | 'B' | 'C' | 'D' | 'E', number>; total: number };
  submit: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="surface p-4 flex items-center gap-3">
        <Input label="Nombre del prospecto" value={prospectName} onChange={(e) => setProspectName(e.target.value)} className="flex-1" required />
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-text-muted">Puntaje actual</div>
          <div className="text-2xl font-bold gradient-text">{calc.total}/100</div>
        </div>
      </div>

      {(['A', 'B', 'C', 'D', 'E'] as const).map((block) => {
        const qs = SOP_QUESTIONS.filter((q) => q.block === block);
        return (
          <section key={block} className="surface p-5">
            <header className="flex items-center justify-between mb-3">
              <h2 className="heading text-base font-bold">Bloque {block} · {SOP_BLOCKS[block]}</h2>
              <span className="text-xs text-text-muted">{calc.blockScores[block]}/20</span>
            </header>
            <div className="space-y-3">
              {qs.map((q) => (
                <div key={q.id} className="rounded-[10px] border border-border-subtle bg-bg-base/30 p-3">
                  <div className="text-xs text-text-primary mb-2">
                    <span className="text-text-muted mr-2">{q.id}.</span> {q.text}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {q.options.map((o, i) => {
                      const sel = answers[q.id] === o.value;
                      return (
                        <button
                          key={i}
                          onClick={() => setAns(q.id, o.value)}
                          className={`rounded-md border px-3 py-1.5 text-xs transition ${sel ? 'border-accent-violet/50 bg-accent-violet/15 text-text-primary' : 'border-border-subtle bg-bg-elevated/30 text-text-secondary hover:bg-bg-elevated'}`}
                        >
                          {o.label} <span className="text-text-muted">({o.value})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <div className="surface p-4 flex justify-end">
        <Button leftIcon={<ClipboardCheck className="h-4 w-4" />} onClick={submit}>
          Calcular viabilidad
        </Button>
      </div>
    </div>
  );
}

function SopResult({ assessment, onReset }: { assessment: SopAssessment; onReset: () => void }) {
  const radarData = (['A', 'B', 'C', 'D', 'E'] as const).map((b) => ({
    block: SOP_BLOCKS[b],
    value: assessment.blockScores[b],
  }));

  const verdictMeta: Record<SopAssessment['verdict'], { label: string; color: string; description: string; recommendation: string }> = {
    ideal:  { label: 'CLIENTE IDEAL ✓', color: '#10B981', description: 'Este cliente tiene alto potencial. Proceder con onboarding.', recommendation: 'Avanza con la propuesta comercial estándar y kickoff en menos de 7 días.' },
    viable: { label: 'CLIENTE VIABLE CON CONDICIONES ⚠️', color: '#F59E0B', description: 'Viable pero revisa los puntos débiles antes de firmar.', recommendation: 'Define expectativas explícitas sobre los bloques con menor puntaje.' },
    risky:  { label: 'CLIENTE DE RIESGO — REVISAR 🔶', color: '#F97316', description: 'Alto riesgo de frustración. Define expectativas o declina.', recommendation: 'Solo aceptar si el cliente acepta un plan extendido y expectativas conservadoras.' },
    reject: { label: 'NO RECOMENDADO ✗', color: '#EF4444', description: 'Este cliente no cumple criterios mínimos. Declinar respetuosamente.', recommendation: 'Enviar carta de declive cordial proponiendo recursos alternativos.' },
  };
  const meta = verdictMeta[assessment.verdict];

  return (
    <div className="space-y-4">
      <section className="surface p-6 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full blur-3xl opacity-25" style={{ background: meta.color }} />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-text-muted">Resultado del diagnóstico</div>
            <h2 className="heading text-2xl font-bold mt-1">{assessment.prospectName}</h2>
            <p className="text-sm text-text-secondary mt-1">{meta.description}</p>
            <p className="text-xs text-text-muted mt-2"><strong>Recomendación:</strong> {meta.recommendation}</p>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">Puntaje</div>
            <div className="kpi-number" style={{ color: meta.color }}>{assessment.score}/100</div>
            <div className="mt-2 rounded-[10px] border px-3 py-1.5 text-xs font-bold" style={{ borderColor: meta.color, color: meta.color, background: `${meta.color}20` }}>
              {meta.label}
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.3fr] gap-4">
        <div className="surface p-5">
          <h3 className="heading text-base font-bold mb-3">Puntuación por bloque</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="rgba(255,255,255,0.08)" />
                <PolarAngleAxis dataKey="block" tick={{ fill: '#A0A0B4', fontSize: 10 }} />
                <PolarRadiusAxis domain={[0, 20]} tick={{ fill: '#6B6B80', fontSize: 9 }} />
                <Radar dataKey="value" stroke={meta.color} fill={meta.color} fillOpacity={0.35} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="surface p-5">
          <h3 className="heading text-base font-bold mb-3">Desglose</h3>
          <div className="space-y-2">
            {(['A', 'B', 'C', 'D', 'E'] as const).map((b) => {
              const pct = (assessment.blockScores[b] / 20) * 100;
              const color = pct >= 75 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#EF4444';
              return (
                <div key={b} className="rounded-md border border-border-subtle bg-bg-base/30 p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="text-sm text-text-primary">Bloque {b} · {SOP_BLOCKS[b]}</div>
                    <div className="text-sm font-semibold" style={{ color }}>{assessment.blockScores[b]}/20</div>
                  </div>
                  <div className="h-1.5 rounded-full bg-bg-elevated overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button variant="secondary" leftIcon={<Sparkles className="h-4 w-4" />} onClick={onReset}>
          Nuevo análisis
        </Button>
        <Button leftIcon={<Download className="h-4 w-4" />} onClick={() => exportSopReport(assessment)}>
          Descargar informe PDF
        </Button>
      </div>
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: SopAssessment['verdict'] }) {
  const map = {
    ideal: { tone: 'success' as const, label: 'Ideal' },
    viable: { tone: 'warning' as const, label: 'Viable' },
    risky: { tone: 'warning' as const, label: 'Riesgo' },
    reject: { tone: 'danger' as const, label: 'Declinar' },
  };
  return <Badge tone={map[verdict].tone}>{map[verdict].label}</Badge>;
}
