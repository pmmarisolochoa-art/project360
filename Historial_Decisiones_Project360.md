# Historial de Decisiones — Project360

> Log **inmutable** de decisiones de este workspace: dirección, presupuestos, lanzamientos, cambios de rumbo. Más recientes arriba. Las decisiones se agregan, nunca se sobreescriben. Si una decisión cruza ecosistemas → también va a `~/Desktop/CLAUDE/Cerebro_Central/Historial_Decisiones_Centrales.md`.

---

## 2026-06-23 (noche) — Reunión real de Marcelo, bug de compromisos y KPI tarea↔Equipo

**Qué:** Continuación operando con Marcelo. Cada cambio con commit + push a `main`:

1. **Cargada la 1ª reunión real de Marcelo** (su `.md` → Notas → "Extraer tareas" → 7 tareas en el Kanban). Se confirmó el flujo de captura de reunión en la app.
2. **Bug corregido (importante):** al confirmar las tareas extraídas, el código hacía `updateMeeting({extractedTasks: []})` — **borraba los compromisos justo después de crearlos**, por lo que el reporte nunca mostraba "Decisiones". Ahora se persiste la lista confirmada; el borrador local ya no se inicializa desde el registro (evita re-crear al reabrir); `markDone` no re-extrae si ya hay compromisos (evita duplicados). Se **backfilleó** la reunión de Marcelo (7 compromisos reconstruidos desde las tareas existentes, sin duplicar).
3. **KPI de tarea ↔ Equipo conectado** (pendiente cerrado): los `kpiResultado` de tareas completadas alimentan la tarjeta de cada persona en "Salud del equipo" (contador `🎯 N/M resultados` + sección "Resultados de tareas" en el detalle + integrados al score/semáforo). Match por nombre o rol. Ver [[project_pending_task_kpi_to_team]] (HECHO).

**Decisiones clave:**
- **Reportes NO se archivan en la app** (opción C): se descargan a la compu; cada cliente organiza su espacio. Construir historial de reportes (Supabase Storage + tabla `reports`) solo si un cliente lo pide. Ver [[project_pending_reports_archive]].
- **Compromisos de reunión = fuente de las "Decisiones"** del reporte: se guardan en `meetings.extracted_tasks`; el fix garantiza que sobrevivan a recargar.

**Por qué:** validar el ciclo real de operación (reunión → tareas → reporte → equipo) con el primer cliente; el camino destapó un bug de persistencia que afectaba a todos los clientes.

**Próximos pasos abiertos:**
- Auto-fill de KPIs desde Meta cuando Marcelo tenga pauta (ad account del cliente, no el personal) — [[project_pending_meta_kpi_autofill]].
- Capa 3 multi-tenant (al final).
- Opcional: campo "Resumen" de reunión para que las Decisiones muestren un párrafo en vez del conteo de compromisos.

---

## 2026-06-23 (tarde) — Correcciones: informe de reunión, KPIs de equipo y meta editable

**Qué:** Tres correcciones sobre lo construido, cada una con commit + push a `main`:

1. **Informe de reunión con el diseño del reporte semanal.** Se extrajo `renderReport()` compartido en `htmlReport.ts` y se agregó `exportMeetingReportHTML` (bloques: agenda, minuta, compromisos, participantes). Sustituye al `exportMeetingReport` viejo (jsPDF "SALES BRAIN OS"). Rewireados `MeetingDrawer` y `ReportsMenu`.
2. **Guía de KPIs de equipo** (no fue cambio de código, fue decisión operativa): las metas de KPI por rol vienen de `ROLE_DEFS` (benchmarks fijos); el valor real se carga **a mano** leyéndolo de Meta Ads Manager.
3. **Meta de KPI de rol editable por cliente** (lápiz ✏️): override por persona en `team_members.kpis.targets` (jsonb existente, sin migración); el semáforo escala sus umbrales en proporción; badge "editada".

**Decisiones clave:**
- **Un solo motor de informes:** todos los reportes (semanal, reunión, futuros) comparten `renderReport` (portada Project360 + header/footer nativos + color por cliente). Se cambia el diseño en un lugar y se propaga.
- **KPIs de equipo: manual durante el lanzamiento de Marcelo**, automatizar cuando haya ads activos (hoy traería ceros). Plan: botón "Traer de Meta" vía MCP.
- **⚠️ Caveat registrado:** la cuenta conectada al MCP de Meta (`act_2627339060997463`) es la cuenta **personal** de la founder, NO la de Marcelo/clientes. El auto-fill por cliente exigirá guardar el ad account propio de cada cliente (campo nuevo en `clients`) + token con acceso. Ver [[project_pending_meta_kpi_autofill]].
- **Metas editables sin migración:** se reusó el jsonb `kpis_custom` (clave nueva `targets`) en vez de columna nueva — cero riesgo en la BD.

**Por qué:** unificar la calidad de los entregables al cliente (todos los informes iguales) y dar flexibilidad operativa real (metas distintas por cliente) sin sobre-ingeniería.

**Próximos pasos:**
- Cuando Marcelo tenga pauta corriendo: construir "Traer de Meta" para KPIs (con el ad account del cliente, no el personal).
- Pendientes previos siguen abiertos: KPI tarea ↔ Equipo, cargar reunión de Marcelo, capa 3 multi-tenant.

---

## 2026-06-23 — Agente Project Manager (Nivel 1) dentro de la app

**Qué:** Se construyó el primer **agente IA conversacional** dentro de Project360: un Project Manager que vive en el cerebro de cada cliente, lee su contexto real y puede proponer acciones (crear tareas, actualizar ROPRE, agendar reuniones) con aprobación del usuario. 5 secciones, cada una con commit + push a `main`:

- **S1 — Catálogo de agentes:** tabla `agent_prompts` (agente, nombre, ícono Lucide, system_prompt, modelo, activo) + seed del agente `pm` (migración **016**).
- **S2 — Chat reutilizable:** componente `AgentChat` (genérico: recibe `clientId` + `agente`) + servicio `agentService.ts` que arma el **contexto del cliente** (perfil/oferta/buyer persona, programa/embudo activo, ROPRE, tareas próximas/vencidas, equipo con % cumplimiento, últimas 2 reuniones ≤500 palabras) + persistencia del historial en `agent_conversations` (migración **017**). Backend: feature `agent_chat` multi-turno en `api/claude.ts` (`callAnthropicChat`).
- **S3 — Acciones con aprobación:** el agente emite un bloque `[ACCION]{json}[/ACCION]`; el frontend lo convierte en una `ActionCard` con `[Editar]`/`[Confirmar y crear]` que ejecuta el INSERT real **reusando los stores existentes** (`addTask`, `useRopreStore.add`, `addMeeting`). Nada se guarda sin confirmación.
- **S4 — Integración:** botón flotante (esquina inferior derecha) + panel lateral deslizante (`AgentPanel`, portal a `document.body`), global a todos los módulos del cerebro — no es un tab, no se pierde el lugar.
- **S5 — Puente a funciones existentes:** `agentTools.ts` detecta la intención ("genera las tareas de la reunión") y reutiliza `extractTasksFromNotes()` sobre la última reunión con notas/transcripción, proponiendo cada tarea como tarjeta. Los botones del `MeetingDrawer` quedan intactos — el chat es un canal ADICIONAL.

**Decisiones clave:**
- **Sin `agencia_id` / multi-tenant** — todo se ancla por `client_id`, igual que el resto del proyecto. Es deuda técnica intencional ya documentada (se activa cuando haya una 3ra agencia pagando).
- **Prompts en la BD, no hardcodeados** (`agent_prompts`): permite editar la personalidad/modelo del agente sin redeploy y escalar a más agentes (`copy`, `content`, `trafficker`) agregando filas. Hay un **prompt de respaldo** en código por si la BD no está disponible (el chat nunca se rompe).
- **El protocolo de acciones vive en el código** (no en el system_prompt de la BD): el texto `[ACCION]` se inyecta en runtime junto al parser, para que formato y parser nunca se desincronicen.
- **Reusar, no duplicar:** las acciones y el puente llaman a las mismas funciones/stores que ya usaban los módulos — el agente es otra puerta de entrada, no una implementación paralela.
- **Degrada con elegancia:** sin migraciones el chat funciona (prompt de respaldo, sin historial persistido); sin API key responde error en burbuja sin tumbar la app.

**Por qué:** dar a la founder/PM un copiloto que ya conoce el estado de cada cliente, para operar más rápido (resúmenes, tareas, ROPRE) sin salir del cerebro del cliente. Es la base del sistema multi-agente (PM es el Nivel 1).

**Validación:** migraciones 016 + 017 corridas en prod; verificado E2E con **Marcelo Duarte** — el agente respondió un plan semanal referenciando el webinar del 29 jul (lee contexto real), propuso una tarea con tarjeta de confirmación (no la creó sola) y persistió la conversación en `agent_conversations`.

**Implicaciones / Próximos pasos:**
- Siguientes agentes (Copy, Content, Trafficker): basta agregar filas a `agent_prompts` y reusar `AgentChat`.
- Pendiente probar el canal de extracción de tareas (S5) cuando Marcelo tenga una reunión con notas cargada.

---

## 2026-06-22/23 — Primer cliente real + rediseño del reporte + módulo Equipo

**Qué:** Sesión de uso real de la app (no demo). Tres bloques:

1. **Walk-through E2E del Sprint E** — validado en prod sin errores (login, programas, KPI por tarea, reporte, portal). 1 mejora detectada y anotada (conectar KPI de tarea ↔ Equipo).
2. **Marcelo Duarte cargado como primer cliente real** (vía SQL en prod, `supabase/seeds/cliente_marcelo_duarte.sql`): cliente + programa "Lanzamiento Webinar GOBERNA" (evento 29 jul, meta 300 a WhatsApp / USD 10.000 a ticket $497) + embudo (4 fases) + ROPRE + 8 tareas reales + equipo. Agencia operando: LaunchXpert LLC. Ver [[project_marcelo_duarte_real_client]].
3. **Rediseño del Reporte Ejecutivo** (nuevo motor `src/services/htmlReport.ts`) y **reconstrucción del módulo Equipo**.

**Decisiones clave:**
- **Reporte: motor HTML → PDF** (html2canvas + jsPDF) en vez del jsPDF manual. Diseño basado en la referencia de la CEO (banda oscura, ROPRE 5 columnas, KPI cards, plan, hitos). **Identidad Project360** (dark + violeta + gradiente) con **firma de color por cliente** (`--accent`/primaryColor). **Documento paginado de verdad:** header/footer nativos en cada página con "Pág X de N", secciones capturadas como bloques y acomodadas sin cortarse. Sustituye al reporte semanal anterior.
- **Decisiones del reporte** salen de las **reuniones** del cliente (si no hay, la sección se omite). Pendiente: capturar reuniones de Marcelo.
- **Módulo Equipo — dos sistemas unificados:** se ocultó el dashboard role-based legacy (datos sembrados de prueba) y se reconstruyó **"Salud del equipo" con datos reales** (cumplimiento, carga, cuellos de botella, gráfica) sobre el sistema nuevo `team_members` + `useTeamKPIs`. Equipos por **rol placeholder** (cada cliente asigna su gente real); se agregó edición de nombre/email en el detalle. Funciones completas por rol restauradas vía SQL (`equipo_funciones_completas.sql`).
- **Orden estratégico confirmado por la CEO:** ① operar con clientes reales primero (impacto y aprendizaje) ② reporte (lo que el cliente recibe = máximo impacto) ③ pulido interno ④ **capa 3 multi-tenant al final** (cuando se venda a otras agencias).

**Por qué:** empezar a usar la app con proyectos reales (prioridad #1 del MVP) y dejar el entregable cliente (reporte) a nivel "CEO".

**Implicaciones / Próximos pasos:**
- Cargar una **reunión** de Marcelo para que aparezcan las Decisiones en el reporte.
- **Conectar KPI de tarea ↔ módulo Equipo** ([[project_pending_task_kpi_to_team]]).
- **Capa 3 — multi-tenant** (agencies con login + RLS por agencia + panel admin): planeada en 4 fases, pendiente. El cimiento existe (tabla `agencies` + `owner_id` + políticas RLS en mig. 004), pero RLS está apagado (permisivo) en beta.

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
# Decisión registrada — Multi-tenant (agencia_id)

**Fecha:** Junio 2026
**Decisión:** NO implementar agencia_id todavía.
**Razón:** Solo 2 agencias en beta (Ikigai, Mared). El costo de
refactorizar todas las tablas ahora no se justifica vs. validar
el producto primero.

**Condición de activación — hacer esto CUANDO:**
- Haya una 3ra agencia pagando (no beta gratis)
- O cuando Ikigai y Mared empiecen a notar fricción real

**Qué falta hacer cuando se active:**
1. Agregar columna agencia_id a: clients, programs, tasks,
   team_members, funnels, meetings, agent_prompts
2. Habilitar RLS en Supabase con policy por agencia_id
3. Activar tabla de medición de tokens por agencia
4. Definir límites de uso de IA por plan