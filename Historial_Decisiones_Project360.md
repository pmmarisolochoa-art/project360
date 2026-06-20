# Historial de Decisiones — Project360

> Log **inmutable** de decisiones de este workspace: dirección, presupuestos, lanzamientos, cambios de rumbo. Más recientes arriba. Las decisiones se agregan, nunca se sobreescriben. Si una decisión cruza ecosistemas → también va a `~/Desktop/CLAUDE/Cerebro_Central/Historial_Decisiones_Centrales.md`.

---

## 2026-06-19 — Sprint E: features de operación para el beta (6 secciones)

**Qué:** Sprint grande sobre la app, 6 secciones en el orden que pidió el CEO, cada una con commit + push a `main`:

- **S0 — Planeación/Métricas/Proyección:** oculté Investigación de Mercado y Sistema de Embudos de Planeación (link a Programas); arreglé el contraste de los escenarios; nota colapsable "cómo se calculan"; **selector de moneda COP/USD/EUR** (persistido por cliente); quité "Vs Mercado"; Métricas en 2 columnas + Indicadores de rendimiento; quité el tab Contenido.
- **S3 — Equipo con personas + KPIs:** tabla `team_members` (mig. 013), agregar personas (nombre/rol/email), funciones editables (chips), KPIs del rol con valor manual + semáforo, KPIs personalizados (manual/auto), hook centralizado `useTeamKPIs`.
- **S4 — Programas:** tabla `programs` + `program_id` en tasks/funnels (mig. 014), tab Programas (resumen + cards), crear programa con materialización de embudo vinculado, filtro por programa en el Kanban.
- **S5 — KPI por tarea:** columnas kpi_* en tasks (mig. 015), sección "Resultado esperado" en el drawer, captura al completar, display en cards con semáforo.
- **S2 — Onboarding editable:** botón "Editar información del cliente" → 8 secciones editables con guardado inmediato.
- **S1 — ROPRE en el PDF semanal:** feature `ropre_weekly` (claude-haiku-4-5) + fallback heurístico, página ROPRE (semáforo + R/O/P/R/E + recomendación PM), columna "Resultado" en completadas.

**Decisiones clave:**
- **No reescribir lo que funciona** — todo se construyó encima (el dashboard de roles, el funnel roadmap y el reporte existente quedaron intactos).
- **Tokens CSS:** el spec pedía `--color-text-*` que NO existen; se usaron los reales (`--text-primary`, etc.). Sin esto el contraste no funcionaba.
- **Moneda (0C.4):** aplicada solo al Funnel financiero (base USD), NO a las metas de revenue del cliente (que van en su propia moneda).
- **Métricas avanzadas (0D)** y **ROPRE IA (S1):** degradan a "—"/heurística cuando faltan datos o la IA falla — nunca bloquean. El modelo demo de Métricas no tiene compras/visitas/video; quedan pendientes de extender el generador demo o conectar Meta real.
- **Ejecución 100% inline:** el subagente `dev` no tiene permiso de escritura en modo aprobación-manual, así que todos los edits los hizo el agente principal con aprobación de la CEO.

**Por qué:** preparar la app con las features operativas (equipo, programas, KPIs, reporte ROPRE) que el CEO necesita para operar con el equipo durante el beta.

**Implicaciones / Próximos pasos:**
- **Pendiente CEO:** correr la migración **015** en Supabase (las 013/014 ya corrieron) para que los KPIs de tarea persistan.
- **Pendiente CEO:** walk-through E2E del flujo nuevo (crear programa → tareas → KPI → completar → resultado).
- Decisión abierta: extender el generador demo de Métricas para que 0D se vea lleno (vs. esperar a conectar Meta real).

---

## 2026-06-16 — Sprint D: app lista para beta con 2 agencias

**Qué:** Se completó el Sprint D para dejar el flujo crítico **crear cliente → elegir embudo → generar tareas → reporte semanal** funcionando end-to-end sin errores, listo para probar con 2 clientes beta (una agencia + una marca personal). Cuatro secciones, cada una con commit + push a `main`:

1. **Kanban** — drag&drop nativo pulido con toast al mover, eliminar tarea inline desde la card (confirmación in-card, sin drawer), filtro por roles canónicos en orden fijo (se agregó el rol `project_manager` a `ROLE_DEFS`).
2. **Embudos** — selector de plantilla movido al **final del onboarding** (4 cards + "Omitir"), materialización masiva de tareas en Supabase con barra de progreso, roadmap visual con countdown de 3 niveles (rojo <7d / amarillo <14d / verde ≥14d), persistencia de `active_funnel_id` en la tabla `clients` (migración **012**), share con cliente vía portal público existente (sin tocar `share_token`/ruta `/client-portal/funnel/:token`).
3. **Reporte semanal PDF** — botón "📊 Reporte semanal" genera PDF de 4 páginas (jsPDF + autotable): portada con color de marca, resumen ejecutivo IA, tablas de completadas/pendientes, foco de próxima semana con prioridades IA. Endpoint nuevo `weekly_report` en `api/claude.ts`.
4. **Pulido beta** — errores de onboarding en español, empty states, `ErrorBoundary` global (sin pantallas en blanco), banner de bienvenida personalizado, 2 clientes seed en Supabase prod.

**Decisiones clave:**
- **Modelo IA del reporte: `claude-haiku-4-5`** (no sonnet) — costo ~$0.005/reporte vs ~$0.04, con fallback heurístico si la API falla. El PDF nunca se bloquea por fallo de IA.
- **No se reescribió lo que ya funcionaba** — la mayor parte de la infra (Kanban drag-drop, plantillas, portal, toasts) ya existía; se hicieron ediciones quirúrgicas mínimas.
- **Seed ejecutado en prod vía SQL Editor de Supabase** (solo había anon key local, no service_role): Mared Agency (`seed_leadmagnet`, 5 tareas) + Ikigai Growth (`evergreen_social`, 5 tareas). Confirmado en prod.
- **MCP de Meta Ads agregado** (oficial `@meta/ads-mcp-server`) en config local del proyecto — pendiente que Marisol autentique vía `/mcp` + login de Meta.

**Por qué:** Las 2 agencias beta entran en pocos días; el objetivo era estabilizar el flujo crítico por encima del pulido cosmético.

**Implicaciones / Próximos pasos:**
- **Pendiente de Marisol:** walk-through visual E2E (checklist de 7 pasos) antes de invitar a las agencias.
- **Pendiente de Marisol:** autenticar el MCP de Meta Ads (`/mcp` → meta-ads → login navegador).
- Detalle menor no crítico: el `<title>` en prod aún dice "Sales Brain OS" (nombre viejo) — cambiar cuando se toque el index.

---

## 2026-06-12 — Inicio del workspace (cerebro Project360)

**Qué:** El repo `~/Desktop/CLAUDE/project360/` se convirtió en Cerebro del sistema: CLAUDE.md de workspace (fusionado con el técnico existente), `Contexto.md`, este historial, `Prompts_Maestros/` y `Datos_Entrada/`. Dos decisiones de Marisol al crearlo: (1) **el nombre oficial es Project360** — "BrainSales" era un nombre anterior y se descarta; los dos registros que estaban separados en pendientes eran el mismo proyecto y se unifican; (2) **prioridades:** ① terminar MVP y usarla con el equipo ② estabilizar lo construido ③ prepararla como SaaS.

**Por qué:** Project360 estaba en "pendientes de cerebro" desde la instalación del sistema; tiene scope, historial y herramientas propias (app en desarrollo activo con 81 commits).

**Implicaciones / Próximos pasos:**
- Primera sesión de trabajo: definir con Marisol qué funciona end-to-end vs. qué falta para el MVP (queda como pendiente en `Contexto.md`).
- El material legado `~/Desktop/CLAUDE/cerebro/Projects/brainsales.md` queda migrado (era plantilla casi vacía; lo útil ya está aquí).
