# Project360 — Arquitectura, Estructura y Workflow

> Documento de referencia para entender cómo está construida la app y cómo seguir desarrollándola.
> Generado desde el código real (no inventado). Fecha: 2026-07-03.

---

## 1. Vista de 10.000 pies — ¿cómo funciona?

Project360 es una app web (SPA) con 3 capas:

```
┌─────────────────────────────────────────────────────────┐
│  FRONTEND (React + Vite)  → lo que ve el usuario         │
│  Corre en el browser. Vive en Vercel.                    │
└───────────────┬─────────────────────────┬───────────────┘
                │                          │
        (lee/escribe datos)         (pide texto IA)
                │                          │
                ▼                          ▼
┌───────────────────────────┐   ┌─────────────────────────┐
│  SUPABASE                 │   │  API /api/claude.ts     │
│  - Postgres (las tablas)  │   │  (Vercel Edge Function) │
│  - Auth (login)           │   │  Proxy a Anthropic.     │
│  - RLS (permisos por rol) │   │  La API key vive AQUÍ,  │
│  El "backend" real.       │   │  nunca en el browser.   │
└───────────────────────────┘   └─────────────────────────┘
```

**Idea clave:** no hay un backend propio tradicional (no hay servidor Node con rutas).
El "backend" es **Supabase** (base de datos + auth + reglas de permisos) y una **sola función serverless** (`/api/claude.ts`) que existe únicamente para esconder la API key de Anthropic. Todo lo demás lo hace el frontend hablando directo con Supabase.

Esto es lo normal y correcto para tu stack. No necesitas montar un backend aparte.

---

## 2. Stack (fijo)

| Capa | Tecnología |
|---|---|
| UI | React 18 + TypeScript + Vite |
| Estilos | Tailwind CSS |
| Estado (memoria de la app) | Zustand (stores) |
| Rutas / navegación | react-router-dom |
| Formularios / validación | react-hook-form + zod |
| Gráficas | recharts |
| PDFs | jspdf + html2canvas (motor HTML→PDF) |
| Base de datos + Auth | Supabase (Postgres) |
| IA | Anthropic (Claude) vía `/api/claude.ts` |
| Deploy | Vercel (rama `main` → producción) |

---

## 3. Estructura del FRONTEND (`src/`)

Cada carpeta tiene un trabajo. Regla mental: **datos suben, UI baja.**

```
src/
├── main.tsx          → arranca la app (monta React + Router)
├── App.tsx           → carga inicial / sesión
├── routes/           → el MAPA de la app: qué URL muestra qué página
│
├── pages/            → PANTALLAS completas (una por ruta)
├── components/       → PIEZAS reutilizables que arman las páginas
├── store/            → MEMORIA de la app (Zustand) — el estado vive aquí
├── services/         → PUENTES hacia afuera (Supabase, Claude, PDFs)
├── hooks/            → lógica reutilizable con estado (ej: sincronizar datos)
├── types/            → definiciones de datos (qué es un Cliente, una Tarea…)
├── data/             → datos estáticos / semillas
└── utils/            → funciones auxiliares sueltas
```

### 3.1 Las páginas (`src/pages/`) — cada pantalla

| Página | Para qué |
|---|---|
| `LoginPage` | Entrar a la app |
| `DashboardMacro` | Home del dueño/agencia — vista global |
| `ClientsPage` | Lista de clientes |
| `ClientBrainPage` | **El "cerebro" de un cliente** — contenedor de todos sus módulos |
| `AgendaPage` | Agenda / calendario |
| `TeamPage` | Equipo y KPIs |
| `AllTasksPage` | Todas las tareas |
| `OnboardingPage` | Alta de cliente nuevo |
| `SettingsPage` | Configuración |
| `SopAgentPage` | Agente SOP (genera procedimientos) |
| `DeliverablesRepoPage` / `LinksRepoPage` | Repositorios de entregables y links |
| `MiEspacio` | **Espacio personal del miembro del equipo** (multi-cliente) |
| `ClientPortalFunnelPage` | Portal PÚBLICO para el cliente final (sin login, por token) |

### 3.2 El "cerebro del cliente" (`src/components/brain/modules/`)

`ClientBrainPage` es un contenedor; adentro carga **módulos** según la pestaña.
Cada módulo es una sección funcional del cliente:

- `ProfileModule` — perfil / info del cliente
- `TasksModule` — tareas
- `RopreModule` — ROPRE (resultados/objetivos)
- `MeetingsModule` — reuniones (extrae tareas de la reunión)
- `PlanningModule` — planeación
- `MetricsModule` — métricas
- `ProjectionsModule` — proyecciones
- `ContentModule` — generación de contenido IA
- `ProgramsModule` — programas
- `TeamModule` / `TeamMembersPanel` — equipo del cliente
- `FunnelLaunchPanel`, `CustomFunnelBuilder`, `AdsGeneratorModal`, `AIOptionsFlow` — embudos y generador de anuncios IA

### 3.3 Los stores (`src/store/`) — la memoria

Cada store maneja un pedazo del estado. Un componente **lee** del store y **dispara acciones**; el store llama a un service para hablar con Supabase.

`useAuthStore` (sesión/rol), `useClientStore`, `useTeamStore` / `useTeamMembersStore`, `useRopreStore`, `useContentStore`, `useFunnelStore` / `useFunnelLaunchStore`, `useProgramsStore`, `useProjectionStore`, `useRepositoryStore`, `useSopStore`, `useIntegrationsStore`, `useNotificationStore` / `useToastStore`, `useUIDrawerStore`, `useAppStore`.

### 3.4 Los services (`src/services/`) — los puentes

Aquí vive **toda** la comunicación con el mundo exterior. Los componentes NO hablan directo con Supabase; pasan por aquí.

- `supabase.ts` — cliente de Supabase (la conexión)
- `repositories.ts` — funciones CRUD (leer/escribir tablas)
- `auth.ts` — login/sesión
- `claudeApi.ts` / `claudeInsights.ts` — llamadas a la IA
- `agentService.ts` / `agentActions.ts` / `agentTools.ts` — el Agente PM
- `htmlReport.ts` / `reportsPdf.ts` / `projectionPdf.ts` / `sopPdf.ts` — motor de reportes/PDF
- `taskLinks.ts` — links de entregables por tarea
- `adsIntegrations.ts`, `benchmarks.ts`, `marketResearchAgent.ts`, `bootstrap.ts`

---

## 4. Estructura del BACKEND

### 4.1 Supabase — la base de datos (`supabase/`)

```
supabase/
├── schema.sql        → esquema base (tablas iniciales)
├── setup_all.sql     → corre todo de una
├── seeds/            → datos de ejemplo
└── migrations/       → cambios a la BD, EN ORDEN (001 → 020)
```

**Tablas (fuente de verdad de los datos):**

| Tabla | Qué guarda |
|---|---|
| `users` | usuarios de la app |
| `agencies` | cuentas/agencias (multi-tenant) |
| `clients` | clientes de la agencia |
| `client_team_members` | quién trabaja en qué cliente |
| `team_members` | personas del equipo + KPIs |
| `tasks` | tareas (incl. `drive_link`) |
| `task_links` | entregables (links) por tarea |
| `ropre_items` | resultados/objetivos ROPRE |
| `meetings` | reuniones y sus compromisos |
| `content_pieces` | contenido/anuncios generados |
| `funnels` / `funnel_phases` | embudos y sus fases |
| `programs` | programas |
| `projections` | proyecciones |
| `ad_metrics_snapshots` | métricas de ads |
| `agent_prompts` / `agent_conversations` | Agente PM (prompts + chats) |
| `notifications` | notificaciones |

**Migraciones = cómo se evoluciona la BD.** Nunca edites una tabla a mano en producción y ya. Cada cambio de estructura es un archivo `NNN_descripcion.sql` numerado. Se corren **en orden** en Supabase. Así el equipo y prod quedan iguales. (Ya van 20; las últimas: 018/019/020 para acceso de miembros y persistencia de ROPRE.)

**RLS (Row Level Security) = los permisos.** Reglas en la BD que definen quién ve/edita qué fila según su rol (`editor` ejecuta, `viewer` revisa, `member` ve solo sus clientes). Es la seguridad real de la app — el frontend confía en esto.

### 4.2 La única función serverless (`api/claude.ts`)

Es una **Vercel Edge Function**. Su único trabajo: recibir la petición del frontend, agregarle la `ANTHROPIC_API_KEY` (que vive solo en Vercel) y reenviarla a Anthropic. Usa `claude-sonnet-4-6` para tareas normales y `claude-haiku-4-5` para resúmenes rápidos.

Por qué existe: si el frontend llamara a Anthropic directo, la API key quedaría expuesta en el browser. Esta función la esconde.

---

## 5. Cómo fluye una acción (ejemplo real)

**"Marco una tarea como completada":**

```
1. Click en el componente (TasksModule)
2. Llama una acción del store (useClientStore / tasks)
3. El store llama a un service (repositories.ts)
4. El service escribe en Supabase (tabla tasks) — RLS valida permiso
5. Supabase responde OK
6. El store actualiza la memoria → la UI se re-dibuja sola
7. (bonus) el KPI de esa persona en Equipo se recalcula (useTeamKPIs)
```

Ese patrón —**componente → store → service → Supabase → vuelve**— se repite en toda la app. Si lo entiendes una vez, lo entiendes todo.

---

## 6. Los roles (quién ve qué)

Definido en `routes/` + RLS:

- **Dueño/Agencia** → entra a todo: dashboard, clientes, equipo, ajustes.
- **Member (equipo)** → home en `/mi-espacio`, solo sus clientes, 5 módulos (Perfil, Tareas, ROPRE, Agenda, Equipo/KPIs). `editor` ejecuta / `viewer` revisa.
- **Cliente final** → portal público `/client-portal/funnel/:token`, sin login.

---

## 7. Fases del producto (dónde estás y qué sigue)

Según tu CLAUDE.md, las prioridades en orden:

```
FASE 1 — TERMINAR EL MVP  ◀── AQUÍ ESTÁS
  Usar la app para operar tus propios clientes con el equipo.
  Hecho: cerebro del cliente, tareas, ROPRE, reuniones, reportes PDF,
         equipo+KPIs, agente PM, generador de anuncios, espacio del miembro.
  Falta: registrar el resto del equipo, Slice 2 (aprobación PM,
         "Mis tareas" con filtros, KPIs personales, botón invitar).

FASE 2 — ESTABILIZAR
  Bugs, UX y deuda técnica ANTES de sumar features.

FASE 3 — VENDER COMO SaaS
  Onboarding self-service, pagos, multi-cuenta. Solo después de 1 y 2.
```

**Regla de oro (de tu CLAUDE.md):** frenar el scope creep. No sumar features nuevas hasta cerrar el MVP y estabilizar.

---

## 8. Workflow de desarrollo (los pasos para construir una feature)

Este es el ciclo que debes seguir cada vez que quieras construir algo:

```
1. DEFINIR   → ¿Qué problema resuelve? ¿Cuál es el resultado esperado?
               (confirmar ANTES de tocar código)

2. DATOS     → ¿Necesita un cambio en la BD?
               → Sí: crear migración nueva  supabase/migrations/0NN_*.sql
                     + regla RLS si aplica. Correrla en Supabase.
               → No: seguir.

3. TIPOS     → Actualizar/crear el tipo en  src/types/

4. SERVICE   → Función que lee/escribe en  src/services/repositories.ts

5. STORE     → Acción + estado en el store correspondiente  src/store/

6. UI        → Componente/módulo en  src/components/  o  src/pages/

7. PROBAR    → npm run dev   (local, localhost)
               npm run typecheck   (que no haya errores de tipos)

8. COMMIT    → commit atómico con mensaje descriptivo

9. DEPLOY    → push a main → Vercel publica solo.
               (revisar seguridad si tocaste auth o pagos)
```

**Comandos:**
```bash
npm run dev        # correr local (desarrollo)
npm run build      # compilar para producción
npm run typecheck  # verificar tipos (hacer ANTES de commit)
npm run preview    # ver el build de producción localmente
```

**Skills que te ayudan en el ciclo:**
- `/build` — construir una feature de punta a punta con garantías de calidad
- `/guardar` — cerrar sesión documentando decisiones
- `/semana` — review ejecutivo semanal

---

## 9. Reglas que protegen el proyecto

- **No inventar datos** — lo que no esté en `Contexto.md` o `Datos_Entrada/`, se pregunta.
- **Migraciones numeradas y en orden** — nunca cambiar la estructura de la BD a mano.
- **Un service por cada cosa externa** — los componentes no hablan directo con Supabase.
- **Commits atómicos** + typecheck antes de merge.
- **Revisar seguridad** en cambios de auth/pagos/RLS.
- **No editar `dist/`** (es el build).
- Decisiones importantes → `Historial_Decisiones_Project360.md`.

---

## 10. Resumen en una frase

> El frontend (React en `src/`) habla con Supabase (tu base de datos y permisos) a través de *services*, guarda estado en *stores*, y usa una sola función serverless (`api/claude.ts`) para la IA. Para construir algo: **BD → tipos → service → store → UI → probar → commit → deploy.**
