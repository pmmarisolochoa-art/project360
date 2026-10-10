import { useState } from 'react';
import { Presentation } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { MEETING_TEMPLATE_LIST, type MeetingTemplateId } from '@/config/meetingTemplates';
import type { Meeting } from '@/types/meeting';
import { withAlpha } from '@/utils/colorGenerator';
import { MeetingModeView } from './MeetingModeView';

/**
 * Botón "Modo Reunión" + selector de plantilla + la vista a pantalla completa.
 * Todo el estado vive aquí: quien lo usa (el drawer de la reunión) solo monta
 * este componente y no sabe nada de plantillas ni pasos.
 */
export function MeetingModeLauncher({ meeting }: { meeting: Meeting }) {
  const [picking, setPicking] = useState(false);
  const [active, setActive] = useState<MeetingTemplateId | null>(null);

  return (
    <>
      <button
        onClick={() => setPicking(true)}
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[10px] text-sm font-medium border border-border-default text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
      >
        <Presentation className="h-4 w-4" /> Modo Reunión
      </button>

      <Modal open={picking} onClose={() => setPicking(false)} title="Elige la plantilla" size="sm">
        <p className="text-sm text-text-muted mb-4">Guía la reunión paso a paso en pantalla completa.</p>
        <div className="grid gap-3">
          {MEETING_TEMPLATE_LIST.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setActive(t.id);
                setPicking(false);
              }}
              className="text-left rounded-[10px] border border-border-default p-4 hover:bg-bg-elevated transition-colors"
              style={{ borderLeftWidth: 4, borderLeftColor: t.color }}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">{t.nombre}</span>
                <span
                  className="text-xs font-medium rounded-full px-2 py-0.5"
                  style={{ background: withAlpha(t.color, 0.15), color: t.color }}
                >
                  {t.duracionSugeridaMin} min
                </span>
              </div>
              <p className="text-sm text-text-muted mt-0.5">{t.descripcion}</p>
            </button>
          ))}
        </div>
      </Modal>

      {active && (
        <MeetingModeView meeting={meeting} initialTemplate={active} onClose={() => setActive(null)} />
      )}
    </>
  );
}
