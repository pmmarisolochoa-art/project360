import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Check, RefreshCw, Pencil, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { toast } from '@/store/useToastStore';
import { withAlpha } from '@/utils/colorGenerator';
import { cn } from '@/utils/cn';
import {
  generateThreeOptions,
  type AIOption,
} from '@/services/claudeApi';

interface Props {
  accent: string;
  section: 'market' | 'offer' | 'narrative' | 'personas';
  context: { businessName: string; industry: string; founderName?: string };
  initialContent?: string;
  onSave: (content: string) => void;
}

/**
 * Flujo de generación con IA en 3 pasos:
 *   1) Generar opciones — muestra 3 cards lado a lado
 *   2) Seleccionar + editar — el usuario elige y puede modificar el texto
 *   3) Complementar — instrucción libre que enriquece el contenido seleccionado
 */
export function AIOptionsFlow({ accent, section, context, initialContent, onSave }: Props) {
  const [stage, setStage] = useState<'idle' | 'options' | 'selected'>(
    initialContent ? 'selected' : 'idle',
  );
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<AIOption[]>([]);
  const [selected, setSelected] = useState<string>(initialContent ?? '');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(initialContent ?? '');
  const [signal, setSignal] = useState('');

  const generate = async (extra?: string) => {
    setLoading(true);
    try {
      const opts = await generateThreeOptions({ section, client: context, signal: extra });
      setOptions(opts);
      setStage('options');
    } finally {
      setLoading(false);
    }
  };

  const complement = async () => {
    if (!signal.trim()) {
      toast.info('Describe qué complementar.');
      return;
    }
    setLoading(true);
    try {
      const opts = await generateThreeOptions({ section, client: context, signal });
      // Usamos sólo la primera variante como "complemento agregado al actual"
      const newText = `${selected.trim()}\n\n— Complemento —\n${opts[0].content}`;
      setSelected(newText);
      setDraft(newText);
      onSave(newText);
      setSignal('');
      toast.success('Complemento agregado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {stage === 'idle' && (
        <Button leftIcon={<Sparkles className="h-4 w-4" />} loading={loading} onClick={() => generate()}>
          Generar opciones con IA
        </Button>
      )}

      {stage === 'options' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">Elige una opción</div>
            <Button size="sm" variant="ghost" leftIcon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => generate()} loading={loading}>
              Regenerar
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <AnimatePresence>
              {options.map((opt) => (
                <motion.div
                  key={opt.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="surface p-4"
                  style={{ borderColor: withAlpha(accent, 0.2) }}
                >
                  <div className="text-xs font-bold text-text-primary mb-2">{opt.title}</div>
                  <p className="text-xs text-text-secondary leading-relaxed mb-3 line-clamp-6">{opt.content}</p>
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setSelected(opt.content);
                      setDraft(opt.content);
                      setStage('selected');
                      onSave(opt.content);
                      toast.success('Opción seleccionada');
                    }}
                  >
                    Seleccionar esta opción
                  </Button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {stage === 'selected' && (
        <>
          <div className="surface p-5 relative" style={{ borderColor: withAlpha(accent, 0.30) }}>
            <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
              <div className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider"
                style={{ background: withAlpha(accent, 0.15), color: accent, border: `1px solid ${withAlpha(accent, 0.35)}` }}>
                <Check className="h-3 w-3" /> Opción seleccionada
              </div>
              <div className="flex items-center gap-1.5">
                {editing ? (
                  <>
                    <Button size="sm" variant="ghost" leftIcon={<X className="h-3.5 w-3.5" />} onClick={() => { setDraft(selected); setEditing(false); }}>Cancelar</Button>
                    <Button size="sm" leftIcon={<Save className="h-3.5 w-3.5" />} onClick={() => { setSelected(draft); onSave(draft); setEditing(false); toast.success('Cambios guardados'); }}>Guardar cambios</Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="secondary" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(true)}>Editar</Button>
                    <Button
                      size="sm"
                      variant="danger"
                      leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
                      onClick={() => {
                        if (confirm('¿Regenerar desde cero? Perderás el contenido actual.')) {
                          generate();
                        }
                      }}
                    >
                      Regenerar desde cero
                    </Button>
                  </>
                )}
              </div>
            </div>

            {editing ? (
              <Textarea rows={8} value={draft} onChange={(e) => setDraft(e.target.value)} />
            ) : (
              <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">{selected}</p>
            )}
          </div>

          {/* Complementar */}
          <div className="surface p-4">
            <div className="text-xs font-medium text-text-secondary mb-2">
              ¿Quieres profundizar algún aspecto? Describe qué agregar:
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={signal}
                onChange={(e) => setSignal(e.target.value)}
                placeholder="Ej: profundiza en el dolor financiero del avatar…"
                className="flex-1"
              />
              <Button size="sm" leftIcon={<Sparkles className="h-3.5 w-3.5" />} loading={loading} onClick={complement}>
                Agregar al análisis
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
