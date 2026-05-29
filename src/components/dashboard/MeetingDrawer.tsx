import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  X, Copy, ExternalLink, Sparkles, Trash2, CheckCircle2, Upload, FileText, Mic, ListChecks,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Meeting, MeetingType } from '@/types/meeting';
import type { Task } from '@/types/task';
import { useClientStore } from '@/store/useClientStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Badge } from '@/components/ui/Badge';
import { generateMeetingAgenda } from '@/services/claudeApi';
import { toast } from '@/store/useToastStore';
import { withAlpha } from '@/utils/colorGenerator';

const TYPE_LABEL: Record<MeetingType, string> = {
  kickoff: 'Kickoff', weekly_metrics: 'Revisión semanal', content_strategy: 'Estrategia de contenido',
  ads_review: 'Revisión de ADS', monthly_closing: 'Cierre mensual', crisis: 'Crisis / Urgente',
};

export function MeetingDrawer({ meeting, onClose }: { meeting: Meeting; onClose: () => void }) {
  const client = useClientStore((s) => s.clients.find((c) => c.id === meeting.clientId));
  const updateMeeting = useClientStore((s) => s.updateMeeting);
  const deleteMeeting = useClientStore((s) => s.deleteMeeting);
  const tasksByClient = useClientStore((s) => s.tasks);
  const addTask = useClientStore((s) => s.addTask);
  const accent = client?.primaryColor ?? '#8B5CF6';

  const [videoLink, setVideoLink] = useState(meeting.videoCallLink ?? '');
  const [agenda, setAgenda] = useState(meeting.agenda ?? '');
  const [notes, setNotes] = useState(meeting.notes ?? '');
  const [recordingUrl, setRecordingUrl] = useState(meeting.recordingUrl ?? '');
  const [generating, setGenerating] = useState(false);
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

  const generateAgenda = async () => {
    if (!client) return;
    setGenerating(true);
    try {
      const pendingTasks = tasksByClient.filter((t) => t.clientId === client.id && t.status !== 'completed').length;
      const hasAds = Object.values(client.adsConnected).some(Boolean);
      const result = await generateMeetingAgenda({
        clientName: client.name,
        industry: client.industry,
        meetingType: meeting.type,
        pendingTasksCount: pendingTasks,
        hasAdsData: hasAds,
      });
      setAgenda(result);
      updateMeeting(meeting.id, { agenda: result });
      toast.success('Agenda generada con IA');
    } finally {
      setGenerating(false);
    }
  };

  const markDone = () => {
    updateMeeting(meeting.id, { completed: true });
    toast.success('Reunión marcada como realizada');
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
              <Button size="sm" variant="secondary" leftIcon={<Upload className="h-3.5 w-3.5" />}
                onClick={() => toast.info('Upload disponible próximamente')}>Subir archivo</Button>
              <Button size="sm" variant="secondary" leftIcon={<Mic className="h-3.5 w-3.5" />}
                onClick={() => toast.info('Transcripción disponible próximamente')}>Transcribir con IA</Button>
              <Button size="sm" variant="secondary" leftIcon={<ListChecks className="h-3.5 w-3.5" />}
                onClick={() => toast.info('Extracción de tareas disponible próximamente')}>Extraer tareas</Button>
            </div>
          </section>

          {/* Tareas extraídas */}
          {meeting.extractedTasks && meeting.extractedTasks.length > 0 && (
            <section>
              <SectionTitle text="✅ Tareas generadas" accent={accent} />
              <ExtractedTasksList
                tasks={meeting.extractedTasks}
                onConfirm={(selected) => {
                  for (const t of selected) {
                    const task: Task = {
                      id: `t_${Math.random().toString(36).slice(2, 7)}`,
                      clientId: meeting.clientId,
                      title: t.title,
                      status: 'pending',
                      priority: 'P2',
                      assignedTo: t.responsibleRole,
                      dueDate: new Date(Date.now() + t.dueInDays * 86400000).toISOString(),
                      isDelayed: false,
                      delayDays: 0,
                      moduleTag: 'meeting',
                      createdAt: new Date().toISOString(),
                    };
                    addTask(task);
                  }
                  toast.success(`${selected.length} tarea${selected.length === 1 ? '' : 's'} creada${selected.length === 1 ? '' : 's'}`);
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
          {!meeting.completed && (
            <Button size="sm" leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />} onClick={markDone}>
              Marcar como realizada
            </Button>
          )}
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
  tasks: NonNullable<Meeting['extractedTasks']>;
  onConfirm: (selected: NonNullable<Meeting['extractedTasks']>) => void;
}) {
  const [checked, setChecked] = useState<boolean[]>(tasks.map(() => false));
  const selectedCount = checked.filter(Boolean).length;
  return (
    <div className="mt-2 space-y-1.5">
      {tasks.map((t, i) => (
        <label key={i} className="flex items-center gap-2 rounded-md border border-border-subtle bg-bg-base/30 px-3 py-2 cursor-pointer">
          <input type="checkbox" checked={checked[i]} onChange={() => {
            const next = [...checked]; next[i] = !next[i]; setChecked(next);
          }} className="h-3.5 w-3.5 accent-accent-violet" />
          <FileText className="h-3.5 w-3.5 text-text-muted shrink-0" />
          <span className="flex-1 text-xs text-text-primary">{t.title}</span>
          <span className="text-[10px] text-text-muted">+{t.dueInDays}d</span>
        </label>
      ))}
      <Button size="sm" disabled={selectedCount === 0} onClick={() => onConfirm(tasks.filter((_, i) => checked[i]))}>
        Crear {selectedCount} tarea{selectedCount === 1 ? '' : 's'}
      </Button>
    </div>
  );
}
