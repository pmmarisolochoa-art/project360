# Project360 — App de gestión 360° de proyectos y clientes

## Qué es este workspace

Terminal especializada en **desarrollar y lanzar Project360**: app propia (React/Supabase/Vercel) para gestionar la operación completa de una agencia/consultora — clientes, tareas, agenda, entregables, equipo y generación IA de contenido y anuncios. Proyecto personal en desarrollo activo (81 commits). *Nota: en docs viejos aparece como "BrainSales" — nombre anterior, el oficial es Project360.*

## Contexto (resumen — detalle vivo en `Contexto.md`)

- **Producto:** sistema operativo de agencia con módulos de dashboard, clientes (Client Brain), tareas, agenda, entregables, equipo, SOP agent, onboarding y generación IA (copies, anuncios con 5 ángulos, arquitectura de marca).
- **Stack fijo:** React + TypeScript + Vite · Tailwind · Supabase · Vercel.
- **Momento actual (junio 2026):** desarrollo activo — Sprint C completado (generador de anuncios IA).

## Prioridades actuales (en orden)

1. **Terminar el MVP** y usarla para operar mis propios proyectos/clientes con el equipo.
2. **Estabilizar lo construido** — bugs, UX y deuda técnica antes de sumar features.
3. **Prepararla para venderse como SaaS** (onboarding, pagos, multi-cuenta) — después de 1 y 2.

## Tu rol (el asistente)

Tech lead + product partner de una founder que es PM, no desarrolladora. Tu trabajo:
- Implementar y revisar features explicando los cambios en español simple.
- Proteger lo que ya funciona: si algo puede romperse, avisar ANTES de tocar.
- Mantener la dirección hacia el MVP — frenar el scope creep de features nuevas.

## Cómo trabajar aquí

- **No inventar datos.** Lo que no esté en `Contexto.md` o `Datos_Entrada/`, se pregunta.
- **Decisiones importantes** → registrarlas en `Historial_Decisiones_Project360.md`.
- **Hacer y corregir > planear infinito.** Reversible = hazlo; irreversible o gasta plata = confirma primero.
- Antes de tocar código, confirmar qué se quiere conseguir.
- Commits atómicos con mensajes descriptivos; tests antes de merge; revisar seguridad en cambios de auth/pagos.
- Al cerrar sesión con avances: `/guardar`.

## Qué NO hacer

- No mezclar con otros workspaces (disciplina de terminales) — lo cross va al Maestro (`~/Desktop/CLAUDE/Cerebro_Central/`).
- **El stack está fijo** — no proponer cambiar React, Supabase ni Vercel.
- No editar `dist/` (build de producción).

## Estructura del workspace

| Carpeta | Qué va |
|---|---|
| `src/` | Código fuente (pages, components, services, store, hooks) |
| `api/` | Endpoints / funciones de API |
| `supabase/` | Configuración y migraciones de base de datos |
| `Contexto.md` | La fuente de verdad del proyecto |
| `Prompts_Maestros/` | Kickoffs reutilizables |
| `Datos_Entrada/` | Material que llega (briefs, specs, feedback) |
| `Historial_Decisiones_Project360.md` | Log inmutable de decisiones |

## Estado
2026-08-03 — **Code-splitting EN PROD (commit `439b19a`): carga inicial 3.9 MB → 1.33 MB / 402 KB gzip (−66%).** (1) **Corrección de plan verificada midiendo:** `manualChunks` NO reduce la primera carga (solo mejora caché entre deploys); lo que la reduce es `import()` dinámico + `React.lazy`. (2) jsPDF/html2canvas/xlsx/mammoth/marked a **carga bajo demanda** — solo se bajan al exportar o subir archivo (3.9→3.0 MB). (3) **Rutas con `React.lazy`+`Suspense`**; `DashboardMacro` y `LoginPage` siguen eager por ser los puntos de entrada. Saca recharts y `ClientBrainPage` (1 MB) del arranque (3.0→1.33 MB). 34 chunks. **Verificado logueado:** 9 rutas sin pantallas en blanco, `/team` con sus 2 gráficas, y PDF real de 3 páginas generado por el `import()` dinámico. ⚠️ **Hallazgo lateral preexistente:** `/team` lanza **39 errores 400** (`22P02`) porque `useTeamStore` hace upsert de IDs del seed (`c_fitmind`, `c_kuroko`, `c_escueladigital`) contra columnas uuid — ruidoso, no rompe UI, pendiente de limpiar. Pendientes: esos upserts del seed; probar **logout→login**.
2026-08-01 — **Escrituras a Supabase ya no fallan en silencio + migración 027 lista (commit `969dcba`, EN PROD).** Los 3 commits de estas sesiones (`d7cd0d0`, `f591aab`, `969dcba`) están pusheados. (1) **Regla nueva: toda escritura optimista avisa al fallar** — 7 de las 9 rutas (clientes/tareas/reuniones × crear/editar/borrar) solo hacían `console.warn`, así que un fallo dejaba al usuario creyendo que guardó; helper `onWriteError()` en `useClientStore` aplicado a las 9. (2) **Migración `027_tasks_updated_at.sql` ✅ CORRIDA en prod (01-ago)** — `updated_at` + trigger `tasks_touch` en `tasks` (reusa `touch_updated_at()` de clients/projections); verificada vía REST. Desactiva la mina de `taskToRow()`, que seguía mapeando el campo. Ojo: las tareas existentes quedaron con `updated_at` = fecha de la migración, no su última edición real. (3) Playwright MCP probado también en **caminos de error** (interceptar `fetch` → 400 forzado) sin tocar datos reales. Pendientes: probar **logout→login** (requiere credenciales); **code-splitting** del bundle de 4 MB — plan en 2 pasos (`manualChunks` primero, `React.lazy` por ruta después), dejado para sesión propia por ser lo más riesgoso.
2026-07-30 — **Playwright MCP integrado como verificación en navegador + 3 fixes de higiene (commit `d7cd0d0`, LOCAL, sin pushear).** (1) **"Cliente en onboarding cuenta como activo"** — el KPI del Dashboard Macro decía `0` con Ikigai activo mientras sidebar y tarjetas decían `1`; nueva fuente única de verdad `ACTIVE_CLIENT_STATUSES` + `isActiveClient()` en `types/client.ts`, consumida por `GlobalStats` y `Sidebar`. (2) **Bootstrap 4 rondas de queries → 1** por carga (idempotente por `userId:agencyId`; `AuthGate` limpia la caché al salir). Ojo: NO se gateó por `agencyId != null` porque los miembros legítimamente lo tienen null. (3) `typecheck` estaba roto desde hacía tiempo (`tsc -b --noEmit` → TS6310); ahora `tsc -b`. 🔴 **Bug de pérdida de datos detectado y revertido:** un cambio sin commitear en `useClientStore.ts` sellaba `updatedAt`, columna que NO existe en `tasks` → toda actualización de tarea daba 400/PGRST204 y se perdía en silencio (solo `console.warn`). Prod nunca afectada. ⚠️ **Sin probar:** ciclo logout→login tras el cambio de bootstrap. Pendiente: pushear `d7cd0d0`; decidir si se agrega `updated_at`+trigger a `tasks`; toast en errores de escritura (no solo `console.warn`); `dist/index.js` pesa 4 MB sin code-splitting.
2026-07-27 — **Sistema de reuniones robustecido (reportes + tipos + anti-duplicados) EN PRODUCCIÓN.** (1) **Reporte ejecutivo de reunión** (IA como PM: titular/deck/KPIs/decisiones/riesgos/próximos pasos) en PDF, con **envío por correo al equipo** (adjunto vía Resend) y **selector de destinatarios**; auto-envío al "Marcar como realizada" + botón manual. Reusa el motor paginado del semanal (`composeReport`) → cabecera/footer por página, A4 correcto, coherente. 3 bugs resueltos: PDF pesado (PNG→JPEG), IA 504 (→FAST_MODEL+notas acotadas), correo inválido tumbaba todo (→valida y omite). (2) **Tipos de reunión** `general` y `management` (gerencia); internas viven en el cliente **Ikigai**; filtro Cliente/Internas + badge. (3) **Anti-duplicados de tareas**: detector+limpieza (banner+modal) y guard `dedupeExtracted()` en los 3 puntos de extracción. (4) UX: chat del agente en **streaming**, filtro de tareas **por persona**, buscador (z-index + deep-link a tarea/reunión). ⚠️ **Proceso externo crea ramas `ci/safety-net*`** y cambia el branch entre commits — revisar. Pendiente: validar E2E el correo del reporte con equipo real; WhatsApp/GHL en standby.
2026-07-23 — **Sprint de cierre de semana EN PRODUCCIÓN + WhatsApp en STANDBY.** (1) Nuevo tipo de reunión `weekly_closing` ("Sprint de cierre de semana"): al abrirla, el drawer muestra automático el cumplimiento de la semana Lun-Dom (N/M + %, completadas vs no completadas con atraso, cumplimiento por responsable — `WeeklyClosingReview.tsx`, sin tokens) y la agenda IA genera estructura PM de 6 puntos (resumen → causas → decisiones reprogramar/reasignar/cancelar → aprendizajes → compromisos). Sin migración (022 liberó el CHECK). Commit `dbec865`. (2) **WhatsApp/GHL congelado:** webhook nuevo probado (200, workflow mapeado) pero **no hay línea de WhatsApp activa en GHL** — recordatorios siguen por email. Opciones para retomar: línea GHL / Cloud API propia de Meta / Telegram (ver historial 2026-07-23). Pendiente: probar el cierre de semana con semana real de Marcelo; decidir camino WhatsApp; registrar resto del equipo.
2026-07-22 — **Bloque B cerrado + alta de equipo self-service EN PRODUCCIÓN.** (1) **Tiempos de entrega / SLA por tipo de tarea** — cierra el bloque B (inteligencia de reuniones): `src/config/taskSLA.ts` (días objetivo por `tag`, editable) + en el recap de la reunión anterior cada compromiso muestra atraso (`hace Nd`) y badge En/Fuera de SLA + resumen `N/M dentro de SLA`. Sin migración. Defaults sin afinar ("vamos evaluando"). (2) **Alta de equipo self-service** — "Invitar miembro" + `api/invitar-miembro.ts` ya existían; ahora el endpoint **manda correo (Resend)** con acceso+contraseña temporal+botón a `/login` (best-effort). Se acabó el alta manual en Supabase. Migraciones 018/021/023 corridas, `SUPABASE_SERVICE_ROLE_KEY` en Vercel, validado E2E (correo llegó). Commits `05dd551`, `40656de`. **GHL/WhatsApp BLOQUEADO en equipo de plataformas** (webhook recibe OK pero su workflow no envía aún). Pendiente: registrar resto del equipo (ya self-service); validar bloque B con Marcelo; tareas por WhatsApp entrante (dep. GHL).
2026-07-02 — **Espacio del miembro del equipo EN PRODUCCIÓN** (main → Vercel). Acceso de equipo (Camino C) + dashboard personal multi-cliente `/mi-espacio`: entregas urgentes, subir entregable (link Drive → `tasks.drive_link` + tabla `task_links`), cronograma por cliente (Kanban/Lista/Gantt), tema claro/oscuro, límite a 5 módulos (Perfil, Tareas, ROPRE, Agenda, Equipo/KPIs). Roles: `editor` ejecuta / `viewer` revisa (RLS). **Bug de fondo corregido:** reuniones y ROPRE no persistían a Supabase → migraciones 018c (lectura miembro) + 020 (columnas ropre_items); ahora persisten y el equipo los ve. Migraciones nuevas: 018/018b/018c/019/019b/020. **1ª persona real dada de alta:** Juan Camilo Correa (editor). Alta de miembros aún manual en Supabase. Pendiente: registrar resto del equipo; Slice 2 (aprobación PM, "Mis tareas" con filtros, KPIs personales, botón invitar).
2026-06-23 (noche) — **1ª reunión real de Marcelo cargada** (7 tareas extraídas). **Bug corregido:** los compromisos de reunión se borraban al confirmar (rompía las "Decisiones" del reporte) → ahora persisten; backfill aplicado a Marcelo. **KPI de tarea ↔ Equipo conectado:** los resultados de tareas completadas alimentan la tarjeta de cada persona (🎯 N/M resultados + sección en el detalle + score). Decisión: reportes NO se archivan en la app (se descargan; archivo solo si un cliente lo pide).
2026-06-23 (tarde) — **Agente PM (Nivel 1)** vivo en prod: chat conversacional en el cerebro del cliente que lee contexto real, propone acciones con aprobación (tarea/ROPRE/reunión) y reusa funciones existentes (extraer tareas de reunión). Migraciones 016+017 corridas, validado E2E con Marcelo. Tabla `agent_prompts` (prompts en BD, sin `agencia_id`). Además: **informe de reunión** unificado al diseño del reporte semanal (motor `renderReport` compartido); **meta de KPI de rol editable por cliente** (lápiz, jsonb sin migración). Pendiente: auto-fill de KPIs desde Meta cuando haya pauta (OJO: MCP Meta = cuenta personal, no la del cliente).
2026-06-23 — Uso real: **Marcelo Duarte** cargado como primer cliente real en prod (lanzamiento webinar GOBERNA, 29 jul). **Reporte Ejecutivo rediseñado** (motor HTML→PDF paginado, header/footer por página, diseño Project360 + color por cliente). **Módulo Equipo reconstruido** (Salud del equipo con datos reales + roles placeholder + funciones completas). Sprint E validado E2E + migración 015 corrida. Pendiente: KPI tarea↔Equipo, cargar reunión de Marcelo, capa 3 multi-tenant.
2026-06-19 — Sprint E completado (6 secciones, 6 commits). Equipo con personas+KPIs, sistema de Programas, KPI por tarea, onboarding editable, ROPRE en el PDF semanal, limpieza de Planeación/Métricas/Proyección. Migraciones 013/014 corridas; **pendiente: correr 015** (KPI por tarea) y walk-through E2E del flujo nuevo.
2026-06-16 — Sprint D completado. App lista para beta con 2 agencias externas. 10 commits, migración 012 + seed Mared/Ikigai en Supabase prod. Pendiente: walk-through visual E2E del CEO.
- 2026-06-12 — Workspace convertido en Cerebro. Nombre oficial confirmado: Project360 (antes "BrainSales"). Pendiente: completar en `Contexto.md` qué funciona vs. qué falta para el MVP.
