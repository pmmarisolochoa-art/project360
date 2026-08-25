/**
 * Configuración → API y Desarrolladores.
 *
 * Panel para emitir y revocar las llaves con las que las aplicaciones externas
 * (hoy: Paralelo / Ikigai GM) leen tareas y agenda de esta agencia.
 *
 * EL DETALLE QUE MANDA EN TODO EL DISEÑO
 * La llave se muestra UNA sola vez. No es una limitación del panel: la base
 * solo guarda su hash, así que después de cerrar el modal nadie —ni el
 * servidor— puede recuperarla. De ahí que el aviso sea grande y el botón de
 * copiar esté antes que el de cerrar.
 */

import { useCallback, useEffect, useState } from 'react';
import { KeyRound, Plus, Copy, Check, AlertTriangle, Ban, ShieldCheck, BookOpen, ChevronDown } from 'lucide-react';
import { ApiActividad } from './ApiActividad';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { toast } from '@/store/useToastStore';
import {
  listarApiKeys,
  crearApiKey,
  revocarApiKey,
  SCOPE_LABELS,
  type ApiKeyRow,
  type CrearKeyPayload,
} from '@/services/apiKeys';

/**
 * Solo estos 4 permisos se ofrecen. La v1 de la API expone únicamente Tareas y
 * Agenda; clientes, métricas, links y equipo no tienen endpoints todavía, así
 * que ofrecer sus permisos sería prometer algo que no existe.
 */
const SCOPES = [
  'read:tasks', 'write:tasks',
  'read:meetings', 'write:meetings',
  // Paso 2 de la integración: por ahora SOLO lectura. La escritura de estos se
  // abre después y de a una, cuando la lectura ya funcione (regla del 6-ago).
  'read:clients', 'read:team', 'read:ropre', 'read:deliverables',
] as const;

const ESCRITURA = new Set(['write:tasks', 'write:meetings']);

const RATE_OPTIONS = [
  { value: '60', label: '60 llamadas / minuto' },
  { value: '100', label: '100 llamadas / minuto' },
  { value: '300', label: '300 llamadas / minuto' },
];

const EXP_OPTIONS = [
  { value: '30d', label: '30 días' },
  { value: '90d', label: '90 días' },
  { value: '1y', label: '1 año' },
  { value: 'nunca', label: 'Nunca' },
];

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export function ApiKeysSection() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [tab, setTab] = useState<'llaves' | 'actividad'>('llaves');
  const [docsAbiertas, setDocsAbiertas] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setKeys(await listarApiKeys());
    } catch (e) {
      // Un miembro (no dueña de agencia) recibe 403: no es un error que valga
      // la pena gritarle, simplemente no administra llaves.
      console.warn('[api-keys] no se pudieron cargar', e);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const revocar = async (k: ApiKeyRow) => {
    if (!confirm(`¿Revocar "${k.nombre}"?\n\nLa aplicación que la use dejará de funcionar de inmediato. Esto no se puede deshacer.`)) return;
    try {
      await revocarApiKey(k.id);
      toast.success('Llave revocada');
      void cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo revocar.');
    }
  };

  const activas = keys.filter((k) => k.activa).length;

  return (
    <section className="surface p-5">
      <header className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-accent-violet" />
          <div>
            <h2 className="heading text-base font-semibold">API y Desarrolladores</h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Llaves para que aplicaciones externas lean tus tareas y tu agenda.
            </p>
          </div>
        </div>
        {tab === 'llaves' && (
          <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setModalAbierto(true)}>
            Generar nueva API Key
          </Button>
        )}
      </header>

      {/* Pestañas. La de Actividad es el audit log: quién llamó, cuándo y cómo salió. */}
      <div className="inline-flex rounded-[10px] border border-border-default bg-bg-base/40 p-1 mb-4">
        {([['llaves', 'Llaves'], ['actividad', 'Actividad']] as const).map(([id, etiqueta]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            aria-pressed={tab === id}
            className={`h-8 px-4 rounded-md text-sm font-medium transition-all ${
              tab === id ? 'bg-accent-indigo text-white shadow-sm' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {tab === 'actividad' ? (
        <ApiActividad keys={keys} />
      ) : (
      <>

      {cargando ? (
        <p className="text-sm text-text-muted py-4">Cargando…</p>
      ) : keys.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-border-subtle px-4 py-8 text-center">
          <p className="text-sm text-text-secondary">Todavía no has generado ninguna llave.</p>
          <p className="text-xs text-text-muted mt-1">
            Una llave le da a una aplicación externa acceso de solo a lo que tú le permitas.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-text-muted border-b border-border-subtle">
                <th className="text-left font-medium py-2 pr-3">Llave</th>
                <th className="text-left font-medium py-2 pr-3">Permisos</th>
                <th className="text-left font-medium py-2 pr-3">Último uso</th>
                <th className="text-left font-medium py-2 pr-3">Expira</th>
                <th className="text-left font-medium py-2 pr-3">Estado</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => {
                const vencida = !!k.expira_en && new Date(k.expira_en) < new Date();
                return (
                  <tr key={k.id} className="border-b border-border-subtle/60 last:border-0">
                    <td className="py-2.5 pr-3">
                      <div className="font-medium">{k.nombre}</div>
                      <code className="text-[11px] text-text-muted">{k.key_prefix}…</code>
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="flex flex-wrap gap-1">
                        {k.scopes.map((s) => (
                          <Badge key={s} tone={ESCRITURA.has(s) ? 'warning' : 'subtle'}>
                            {SCOPE_LABELS[s] ?? s}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 text-text-secondary">{fecha(k.ultimo_uso)}</td>
                    <td className="py-2.5 pr-3 text-text-secondary">{k.expira_en ? fecha(k.expira_en) : 'Nunca'}</td>
                    <td className="py-2.5 pr-3">
                      {!k.activa ? (
                        <Badge tone="danger">Revocada</Badge>
                      ) : vencida ? (
                        <Badge tone="warning">Expirada</Badge>
                      ) : (
                        <Badge tone="success">Activa</Badge>
                      )}
                    </td>
                    <td className="py-2.5 text-right">
                      {k.activa && (
                        <Button
                          size="sm"
                          variant="ghost"
                          leftIcon={<Ban className="h-3.5 w-3.5" />}
                          onClick={() => revocar(k)}
                        >
                          Revocar
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {keys.length > 0 && (
        <p className="text-xs text-text-muted mt-3 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" />
          {activas} activa{activas === 1 ? '' : 's'}. Las llaves nunca ven tareas ni reuniones privadas.
        </p>
      )}

      {/* Resumen para desarrolladores. La documentación completa que se le
          ENVÍA a la gente de fuera vive en API_PUBLICA.md — acá solo lo justo
          para responder sin ir a buscar el archivo. */}
      <div className="mt-4 rounded-[10px] border border-border-subtle">
        <button
          onClick={() => setDocsAbiertas((v) => !v)}
          aria-expanded={docsAbiertas}
          className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm focus-ring"
        >
          <span className="flex items-center gap-2">
            <BookOpen className="h-3.5 w-3.5 text-accent-violet" />
            ¿Qué le mando a quien va a integrar?
          </span>
          <ChevronDown className={`h-4 w-4 text-text-muted transition-transform ${docsAbiertas ? 'rotate-180' : ''}`} />
        </button>
        {docsAbiertas && (
          <div className="px-4 pb-4 pt-1 text-sm text-text-secondary space-y-2.5 border-t border-border-subtle">
            <p>
              Mándale el archivo <code className="text-xs">API_PUBLICA.md</code> del repositorio: tiene los
              7 endpoints, los códigos de error y ejemplos listos para copiar.
            </p>
            <div>
              <div className="text-xs font-medium text-text-primary mb-1">Lo esencial</div>
              <ul className="text-xs space-y-1 list-disc list-inside">
                <li>Base: <code>{typeof window !== 'undefined' ? window.location.origin : ''}/api/v1</code></li>
                <li>Cabecera: <code>Authorization: Bearer pk_live_…</code></li>
                <li>Solo desde su servidor — no funciona desde un navegador.</li>
                <li>Que use siempre <code>external_id</code> al crear tareas: evita duplicados.</li>
              </ul>
            </div>
            <p className="text-xs">
              Empieza dándole una llave de <strong>solo lectura</strong>. Cuando la integración funcione,
              emites otra con escritura — no hace falta tocar nada más.
            </p>
          </div>
        )}
      </div>

      </>
      )}

      <NuevaKeyModal
        open={modalAbierto}
        onClose={() => setModalAbierto(false)}
        onCreada={() => void cargar()}
      />
    </section>
  );
}

/** Modal de creación. Tiene dos estados: el formulario y el secreto recién creado. */
function NuevaKeyModal({
  open,
  onClose,
  onCreada,
}: {
  open: boolean;
  onClose: () => void;
  onCreada: () => void;
}) {
  const [nombre, setNombre] = useState('');
  const [scopes, setScopes] = useState<string[]>(['read:tasks', 'read:meetings']);
  const [rateLimit, setRateLimit] = useState('100');
  const [expiracion, setExpiracion] = useState<CrearKeyPayload['expiracion']>('90d');
  const [guardando, setGuardando] = useState(false);
  const [secreto, setSecreto] = useState<string | null>(null);
  const [copiada, setCopiada] = useState(false);

  const reiniciar = () => {
    setNombre('');
    setScopes(['read:tasks', 'read:meetings']);
    setRateLimit('100');
    setExpiracion('90d');
    setSecreto(null);
    setCopiada(false);
  };

  const cerrar = () => {
    onClose();
    // Se limpia después de la animación de salida para que no parpadee.
    setTimeout(reiniciar, 200);
  };

  const toggle = (s: string) =>
    setScopes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const crear = async () => {
    setGuardando(true);
    try {
      const { key } = await crearApiKey({
        nombre: nombre.trim(),
        scopes,
        rateLimit: Number(rateLimit),
        expiracion,
      });
      setSecreto(key);
      onCreada();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo crear la llave.');
    } finally {
      setGuardando(false);
    }
  };

  const copiar = async () => {
    if (!secreto) return;
    try {
      await navigator.clipboard.writeText(secreto);
      setCopiada(true);
      toast.success('Llave copiada');
    } catch {
      // Sin permiso de portapapeles (o http). El input es seleccionable a mano.
      toast.error('No se pudo copiar. Selecciónala y cópiala manualmente.');
    }
  };

  return (
    <Modal
      open={open}
      onClose={cerrar}
      title={secreto ? 'Tu nueva API Key' : 'Generar nueva API Key'}
      footer={
        secreto ? (
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={cerrar}>
              Ya la guardé, cerrar
            </Button>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={cerrar}>
              Cancelar
            </Button>
            <Button onClick={crear} loading={guardando} disabled={!nombre.trim() || scopes.length === 0}>
              Generar llave
            </Button>
          </div>
        )
      }
    >
      {secreto ? (
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-[10px] border border-amber-500/40 bg-amber-500/10 px-3 py-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm">
              <strong>Guarda esta key ahora. No podrás verla de nuevo.</strong>
              <br />
              <span className="text-text-secondary">
                Solo guardamos una huella cifrada. Si la pierdes, se revoca y se genera otra.
              </span>
            </p>
          </div>
          <div className="flex gap-2">
            <input
              readOnly
              value={secreto}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 rounded-[10px] border border-border-default bg-bg-elevated px-3 py-2 font-mono text-xs"
            />
            <Button
              variant="secondary"
              leftIcon={copiada ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              onClick={copiar}
            >
              {copiada ? 'Copiada' : 'Copiar key'}
            </Button>
          </div>
          <p className="text-xs text-text-muted">
            Se usa en la cabecera <code>Authorization: Bearer …</code>. Trátala como una contraseña:
            nunca en el código de una app, siempre en variables de entorno.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <Input
            label="Nombre de la aplicación"
            placeholder="Ej: Paralelo — Ikigai GM"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            hint="Para reconocerla después en la lista. No lo ve nadie de fuera."
          />

          <div>
            <div className="text-xs font-medium mb-2">Permisos</div>
            <div className="space-y-1.5">
              {SCOPES.map((s) => (
                <label
                  key={s}
                  className="flex items-center gap-2.5 rounded-[10px] border border-border-subtle px-3 py-2 cursor-pointer hover:border-accent-primary/40 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={scopes.includes(s)}
                    onChange={() => toggle(s)}
                    className="accent-[var(--accent-primary)]"
                  />
                  <span className="text-sm flex-1">{SCOPE_LABELS[s]}</span>
                  <code className="text-[11px] text-text-muted">{s}</code>
                  {ESCRITURA.has(s) && <Badge tone="warning">escribe</Badge>}
                </label>
              ))}
            </div>
            <p className="text-xs text-text-muted mt-2">
              Da solo lo mínimo que la aplicación necesite. Si con leer le alcanza, no le des escritura
              — siempre puedes emitir otra llave después.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Límite de uso"
              options={RATE_OPTIONS}
              value={rateLimit}
              onChange={(e) => setRateLimit(e.target.value)}
            />
            <Select
              label="Expiración"
              options={EXP_OPTIONS}
              value={expiracion}
              onChange={(e) => setExpiracion(e.target.value as CrearKeyPayload['expiracion'])}
              hint="Una llave que expira limita el daño si se filtra."
            />
          </div>
        </div>
      )}
    </Modal>
  );
}
