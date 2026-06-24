import { useEffect, useRef, useState } from 'react';
import * as Icons from 'lucide-react';
import { Send, Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import { withAlpha } from '@/utils/colorGenerator';
import { useClientStore } from '@/store/useClientStore';
import {
  loadAgentDef,
  loadConversation,
  saveMessage,
  buildClientContext,
  type AgentDef,
  type ChatMessage,
} from '@/services/agentService';
import { sendAgentMessage } from '@/services/claudeApi';

interface UiMessage extends ChatMessage {
  id: string;
  error?: boolean;
}

interface AgentChatProps {
  clientId: string;
  agente: string;
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

/**
 * Chat genérico reutilizable con un agente IA (PM por ahora).
 * Carga el system prompt + el contexto del cliente, mantiene historial persistido
 * en agent_conversations y conversa multi-turno con Claude vía /api/claude.
 */
export function AgentChat({ clientId, agente }: AgentChatProps) {
  const client = useClientStore((s) => s.clients.find((c) => c.id === clientId));
  const accent = client?.primaryColor ?? '#8B5CF6';

  const [agentDef, setAgentDef] = useState<AgentDef | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Carga inicial: definición del agente + historial de los últimos 20 mensajes.
  useEffect(() => {
    let alive = true;
    setLoadingHistory(true);
    (async () => {
      const [def, history] = await Promise.all([
        loadAgentDef(agente),
        loadConversation(clientId, agente, 20),
      ]);
      if (!alive) return;
      setAgentDef(def);
      setMessages(history.map((m) => ({ ...m, id: newId() })));
      setLoadingHistory(false);
    })();
    return () => {
      alive = false;
    };
  }, [clientId, agente]);

  // Auto-scroll al fondo cuando llegan mensajes.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const AgentIcon =
    (agentDef && (Icons as Record<string, unknown>)[agentDef.icono]) ||
    Icons.ClipboardList;

  async function handleSend() {
    const text = input.trim();
    if (!text || sending || !agentDef) return;

    const userMsg: UiMessage = { id: newId(), role: 'user', content: text };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    setSending(true);
    void saveMessage(clientId, agente, 'user', text);

    try {
      const system =
        agentDef.systemPrompt +
        '\n\nCONTEXTO ACTUAL DEL CLIENTE:\n' +
        buildClientContext(clientId);

      const reply = await sendAgentMessage({
        system,
        messages: history.map((m) => ({ role: m.role, content: m.content })),
        model: agentDef.modelo,
      });

      const assistantMsg: UiMessage = { id: newId(), role: 'assistant', content: reply };
      setMessages((prev) => [...prev, assistantMsg]);
      void saveMessage(clientId, agente, 'assistant', reply);
    } catch (e) {
      console.warn('[AgentChat] error', e);
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: 'assistant',
          content: 'No pude responder en este momento. Revisa la conexión e intenta de nuevo.',
          error: true,
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  const IconCmp = AgentIcon as React.ComponentType<{ className?: string }>;

  return (
    <div className="flex h-full flex-col">
      {/* Mensajes */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {loadingHistory ? (
          <div className="flex items-center justify-center h-full text-text-muted text-sm gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div
              className="h-12 w-12 rounded-xl flex items-center justify-center mb-3"
              style={{ background: withAlpha(accent, 0.15), color: accent }}
            >
              <IconCmp className="h-6 w-6" />
            </div>
            <p className="text-text-primary font-medium">{agentDef?.nombreDisplay ?? 'Agente'}</p>
            <p className="text-text-muted text-sm mt-1 max-w-xs">
              Pregúntame sobre el estado del proyecto, pídeme un resumen de la semana,
              tareas de una reunión o el ROPRE actual.
            </p>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={cn('flex gap-2.5', m.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              {m.role === 'assistant' && (
                <div
                  className="h-7 w-7 shrink-0 rounded-lg flex items-center justify-center mt-0.5"
                  style={{ background: withAlpha(accent, 0.15), color: accent }}
                >
                  <IconCmp className="h-4 w-4" />
                </div>
              )}
              <div
                className={cn(
                  'rounded-2xl px-3.5 py-2 text-sm max-w-[78%] whitespace-pre-wrap leading-relaxed',
                  m.role === 'user'
                    ? 'text-white rounded-br-sm'
                    : m.error
                      ? 'bg-bg-elevated text-status-danger rounded-bl-sm'
                      : 'bg-bg-elevated text-text-primary rounded-bl-sm',
                )}
                style={m.role === 'user' ? { background: accent } : undefined}
              >
                {m.content}
              </div>
            </div>
          ))
        )}

        {sending && (
          <div className="flex gap-2.5 justify-start">
            <div
              className="h-7 w-7 shrink-0 rounded-lg flex items-center justify-center mt-0.5"
              style={{ background: withAlpha(accent, 0.15), color: accent }}
            >
              <IconCmp className="h-4 w-4" />
            </div>
            <div className="bg-bg-elevated rounded-2xl rounded-bl-sm px-3.5 py-2.5 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-text-muted animate-bounce [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-text-muted animate-bounce [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-text-muted animate-bounce" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border-subtle p-3">
        <div className="flex items-end gap-2 rounded-xl bg-bg-elevated border border-border-subtle px-3 py-2 focus-within:border-border-default">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Escribe tu mensaje…"
            className="flex-1 resize-none bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none max-h-32 py-1"
          />
          <button
            onClick={() => void handleSend()}
            disabled={!input.trim() || sending}
            className="h-8 w-8 shrink-0 rounded-lg flex items-center justify-center text-white disabled:opacity-40 transition-opacity"
            style={{ background: accent }}
            aria-label="Enviar"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
