import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icons from 'lucide-react';
import { X, ClipboardList } from 'lucide-react';
import type { Client } from '@/types/client';
import { withAlpha } from '@/utils/colorGenerator';
import { AgentChat } from '@/components/agent/AgentChat';

const AGENTE = 'pm';

/**
 * Botón flotante + panel lateral del Agente PM.
 * Vive en el cerebro del cliente y persiste al cambiar de módulo (no es un tab).
 * Minimizable sin perder el historial de la sesión (el chat se desmonta pero
 * recarga su historial desde agent_conversations al reabrir).
 */
export function AgentPanel({ client }: { client: Client }) {
  const [open, setOpen] = useState(false);
  const accent = client.primaryColor || '#8B5CF6';

  // Ícono del agente (estático por ahora: PM = ClipboardList).
  const Icon = ((Icons as Record<string, unknown>).ClipboardList || ClipboardList) as React.ComponentType<{ className?: string }>;

  return createPortal(
    <>
      {/* Botón flotante */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full flex items-center justify-center text-white shadow-lg hover:scale-105 transition-transform"
          style={{ background: accent, boxShadow: `0 8px 28px ${withAlpha(accent, 0.45)}` }}
          aria-label="Abrir Agente PM"
          title="Agente PM"
        >
          <Icon className="h-6 w-6" />
        </button>
      )}

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop sutil (no bloquea visualmente todo el cerebro) */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-bg-base/40 backdrop-blur-[2px]"
            />

            {/* Panel lateral derecho */}
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-bg-surface border-l border-border-default flex flex-col shadow-2xl"
            >
              <header
                className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border-subtle"
                style={{ background: withAlpha(accent, 0.08) }}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="h-8 w-8 rounded-lg flex items-center justify-center"
                    style={{ background: withAlpha(accent, 0.18), color: accent }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-text-primary font-medium leading-tight">Agente PM</p>
                    <p className="text-text-muted text-xs leading-tight">{client.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="h-8 w-8 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
                  aria-label="Minimizar"
                >
                  <X className="h-4 w-4 mx-auto" />
                </button>
              </header>

              <div className="flex-1 min-h-0">
                <AgentChat clientId={client.id} agente={AGENTE} />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>,
    document.body,
  );
}
