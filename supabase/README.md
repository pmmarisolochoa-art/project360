# Supabase — Sales Brain OS

Setup de backend con Supabase. Por defecto la app corre en **modo LOCAL** (seed en memoria). Para activar persistencia remota seguir los pasos abajo.

## 1. Crear proyecto

1. https://supabase.com/dashboard → **New project**
2. Nombre: `project360`, región cercana a ti, password fuerte (guardarlo).
3. Esperar ~2 min a que aprovisione.

## 2. Aplicar migraciones (en orden)

Abre el **SQL Editor** del proyecto y ejecuta en orden:

1. **`schema.sql`** — schema base: 11 tablas + índices + RLS habilitado + policies.
2. **`migrations/001_add_meeting_columns.sql`** — añade `video_call_link`, `notes`, `notes_updated_at`, `completed` en `meetings` (usados por MeetingDrawer).
3. **`migrations/002_disable_rls_dev.sql`** — ⚠️ deshabilita RLS para que la app funcione sin Supabase Auth. NO usar en producción.
4. **`migrations/003_seed_data.sql`** — inserta los 3 clientes demo (FitMind, Kuroko, Escuela Digital) + 9 tareas + 4 reuniones con UUIDs deterministas.

## 3. Configurar `.env.local`

En **Settings → API** del proyecto Supabase copia:

- **Project URL** → `VITE_SUPABASE_URL`
- **anon public key** → `VITE_SUPABASE_ANON_KEY`

Crea `.env.local` en la raíz del proyecto (ya está en `.gitignore`):

```bash
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

## 4. Verificar

```bash
npm run dev
```

Debes ver en la consola del browser:

```
[bootstrap] Hidratado desde Supabase: 3 clientes, 9 tareas, 4 reuniones.
```

Ir a `/settings` → sección "Backend & datos" debe mostrar el badge verde **"Supabase remoto"**.

## Migrar a producción

Antes de exponer la app al mundo:

1. Implementar Supabase Auth (login/signup) y conectarlo a `useAppStore`.
2. Crear registros en `users` y `agencies` con los `auth.uid()` reales de cada owner.
3. Revertir la migración 002 — re-habilitar RLS:

```sql
alter table public.users               enable row level security;
alter table public.agencies            enable row level security;
alter table public.clients             enable row level security;
alter table public.client_team_members enable row level security;
alter table public.ropre_items         enable row level security;
alter table public.tasks               enable row level security;
alter table public.meetings            enable row level security;
alter table public.content_pieces      enable row level security;
alter table public.ad_metrics_snapshots enable row level security;
alter table public.projections         enable row level security;
alter table public.notifications       enable row level security;
```

4. Revisar y ajustar las policies del `schema.sql` (sección "ROW LEVEL SECURITY").
5. Eliminar el seed de la migración 003 o reemplazarlo por datos reales.
