import { useState } from 'react';
import { User as UserIcon, Database, Bell, LogOut, AlertTriangle, Check, X, Sliders, Moon, Sun, Palette } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useIntegrationsStore } from '@/store/useIntegrationsStore';
import { usingRemote } from '@/services/supabase';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { IntegrationsModal } from '@/components/dashboard/IntegrationsModal';
import { toast } from '@/store/useToastStore';

const TIMEZONES = [
  'America/Mexico_City',
  'America/Bogota',
  'America/Buenos_Aires',
  'America/Lima',
  'America/Santiago',
  'America/New_York',
  'Europe/Madrid',
  'UTC',
];

export function SettingsPage() {
  const user = useAppStore((s) => s.currentUser);
  const signOut = useAppStore((s) => s.signOut);
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useAppStore((s) => s.setSidebarCollapsed);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const signIn = useAppStore((s) => s.signIn);
  const integrations = useIntegrationsStore();
  const [integrationsOpen, setIntegrationsOpen] = useState(false);

  const [profile, setProfile] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    whatsapp: user?.whatsapp ?? '',
    timezone: user?.timezone ?? 'America/Mexico_City',
  });

  const connectedCount = [
    integrations.googleCalendar.connected,
    integrations.calendly.connected,
    integrations.zoom.connected,
    integrations.googleMeet.connected,
    integrations.teams.connected,
  ].filter(Boolean).length;

  const saveProfile = () => {
    if (!user) return;
    signIn({ ...user, ...profile });
    toast.success('Perfil actualizado');
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1100px] mx-auto space-y-5">
      <header>
        <div className="text-[11px] uppercase tracking-[0.22em] text-text-muted mb-1.5">
          Configuración
        </div>
        <h1 className="heading text-3xl lg:text-4xl font-bold">
          <span className="gradient-text">Ajustes</span> de cuenta
        </h1>
        <p className="text-sm text-text-secondary mt-1.5">
          Perfil, preferencias, integraciones y backend.
        </p>
      </header>

      <section className="surface p-5">
        <header className="flex items-center gap-2 mb-4">
          <Palette className="h-4 w-4 text-accent-violet" />
          <h2 className="heading text-base font-semibold">Apariencia</h2>
        </header>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-sm text-text-primary">Tema de la interfaz</div>
            <div className="text-xs text-text-muted mt-0.5">
              Se aplica al instante y se recuerda para próximas sesiones.
            </div>
          </div>
          <div className="inline-flex rounded-[10px] border border-border-default bg-bg-base/40 p-1">
            <button
              onClick={() => setTheme('dark')}
              aria-pressed={theme === 'dark'}
              className={`h-9 px-4 rounded-md text-sm font-medium inline-flex items-center gap-2 transition-all duration-300 ${
                theme === 'dark'
                  ? 'bg-accent-indigo text-white shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Moon className="h-4 w-4" /> Oscuro
            </button>
            <button
              onClick={() => setTheme('light')}
              aria-pressed={theme === 'light'}
              className={`h-9 px-4 rounded-md text-sm font-medium inline-flex items-center gap-2 transition-all duration-300 ${
                theme === 'light'
                  ? 'bg-accent-indigo text-white shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Sun className="h-4 w-4" /> Claro
            </button>
          </div>
        </div>
      </section>

      <section className="surface p-5">
        <header className="flex items-center gap-2 mb-4">
          <UserIcon className="h-4 w-4 text-accent-violet" />
          <h2 className="heading text-base font-semibold">Perfil</h2>
        </header>
        {!user ? (
          <div className="text-sm text-text-muted">Sin sesión activa.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Nombre">
              <Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
            </Field>
            <Field label="Email">
              <Input type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
            </Field>
            <Field label="WhatsApp">
              <Input value={profile.whatsapp} onChange={(e) => setProfile({ ...profile, whatsapp: e.target.value })} placeholder="+52 55 1234 5678" />
            </Field>
            <Field label="Zona horaria">
              <Select
                value={profile.timezone}
                onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
                options={TIMEZONES.map((tz) => ({ value: tz, label: tz }))}
              />
            </Field>
            <Field label="Rol">
              <div className="h-9 flex items-center"><Badge tone="accent">{user.role}</Badge></div>
            </Field>
            <Field label="Cuenta creada">
              <div className="h-9 flex items-center text-xs text-text-muted">{new Date(user.createdAt).toLocaleDateString('es')}</div>
            </Field>
            <div className="md:col-span-2 flex justify-end">
              <Button onClick={saveProfile}>Guardar cambios</Button>
            </div>
          </div>
        )}
      </section>

      <section className="surface p-5">
        <header className="flex items-center gap-2 mb-4">
          <Sliders className="h-4 w-4 text-accent-violet" />
          <h2 className="heading text-base font-semibold">Preferencias</h2>
        </header>
        <div className="space-y-3">
          <ToggleRow
            label="Sidebar colapsado por defecto"
            description="Inicia la app con la barra lateral compacta"
            value={sidebarCollapsed}
            onChange={setSidebarCollapsed}
          />
          <ToggleRow
            label="Notificaciones push"
            description="Próximamente — requiere configurar service worker"
            value={false}
            onChange={() => toast.info('Disponible próximamente')}
            disabled
          />
        </div>
      </section>

      <section className="surface p-5">
        <header className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-accent-violet" />
            <h2 className="heading text-base font-semibold">Integraciones</h2>
          </div>
          <button
            onClick={() => setIntegrationsOpen(true)}
            className="text-xs text-accent-violet hover:underline"
          >
            Configurar →
          </button>
        </header>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {[
            { key: 'googleCalendar', label: 'Google Calendar', on: integrations.googleCalendar.connected },
            { key: 'calendly', label: 'Calendly', on: integrations.calendly.connected },
            { key: 'zoom', label: 'Zoom', on: integrations.zoom.connected },
            { key: 'googleMeet', label: 'Google Meet', on: integrations.googleMeet.connected },
            { key: 'teams', label: 'Microsoft Teams', on: integrations.teams.connected },
          ].map((it) => (
            <div key={it.key} className={`rounded-md border p-2.5 ${it.on ? 'border-status-success/40 bg-status-success/5' : 'border-border-subtle bg-bg-base/30'}`}>
              <div className="text-[11px] font-medium text-text-primary truncate">{it.label}</div>
              <div className={`text-[10px] mt-1 inline-flex items-center gap-1 ${it.on ? 'text-status-success' : 'text-text-muted'}`}>
                {it.on ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                {it.on ? 'Conectado' : 'Sin conectar'}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-text-muted mt-3">
          {connectedCount} de 5 integraciones activas.
        </p>
      </section>

      <section className="surface p-5">
        <header className="flex items-center gap-2 mb-4">
          <Database className="h-4 w-4 text-accent-violet" />
          <h2 className="heading text-base font-semibold">Backend & datos</h2>
        </header>
        <div className="space-y-2 text-sm">
          <Row label="Modo de persistencia">
            {usingRemote ? (
              <Badge tone="success">Supabase remoto</Badge>
            ) : (
              <Badge tone="warning">Local (seed en memoria)</Badge>
            )}
          </Row>
          <Row label="VITE_SUPABASE_URL">
            <span className="text-xs text-text-muted font-mono">
              {import.meta.env.VITE_SUPABASE_URL ? '••• configurado' : 'no configurado'}
            </span>
          </Row>
          <Row label="VITE_SUPABASE_ANON_KEY">
            <span className="text-xs text-text-muted font-mono">
              {import.meta.env.VITE_SUPABASE_ANON_KEY ? '••• configurado' : 'no configurado'}
            </span>
          </Row>
        </div>
        {!usingRemote && (
          <div className="mt-3 rounded-md border border-border-subtle bg-bg-base/30 p-3 text-[11px] text-text-muted leading-relaxed">
            <strong className="text-text-primary">Para activar Supabase:</strong> crea proyecto en{' '}
            <span className="font-mono">supabase.com</span>, ejecuta las migraciones en{' '}
            <span className="font-mono">supabase/schema.sql</span>, y copia las variables a{' '}
            <span className="font-mono">.env.local</span>.
          </div>
        )}
      </section>

      <section className="surface p-5 border border-status-danger/30">
        <header className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-4 w-4 text-status-danger" />
          <h2 className="heading text-base font-semibold text-status-danger">Zona crítica</h2>
        </header>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm text-text-primary">Cerrar sesión</div>
            <div className="text-xs text-text-muted">Desconecta al usuario actual de Capa 0.</div>
          </div>
          <Button
            variant="secondary"
            onClick={async () => {
              if (!confirm('¿Cerrar sesión?')) return;
              signOut();
              try {
                const { signOut: supaSignOut } = await import('@/services/auth');
                await supaSignOut();
              } catch { /* noop */ }
              toast.success('Sesión cerrada');
              window.location.href = '/login';
            }}
          >
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </Button>
        </div>
      </section>

      <IntegrationsModal open={integrationsOpen} onClose={() => setIntegrationsOpen(false)} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wider text-text-muted mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border-subtle/30 pb-2 last:border-0 last:pb-0">
      <span className="text-text-secondary">{label}</span>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-border-subtle/30 last:border-0">
      <div>
        <div className="text-sm text-text-primary">{label}</div>
        <div className="text-xs text-text-muted">{description}</div>
      </div>
      <button
        onClick={() => !disabled && onChange(!value)}
        disabled={disabled}
        className={`relative h-5 w-9 rounded-full transition ${value ? 'bg-accent-violet' : 'bg-bg-elevated border border-border-subtle'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-pressed={value}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${value ? 'translate-x-[18px]' : 'translate-x-0.5'}`}
        />
      </button>
    </div>
  );
}
