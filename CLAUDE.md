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
2026-06-23 — Uso real: **Marcelo Duarte** cargado como primer cliente real en prod (lanzamiento webinar GOBERNA, 29 jul). **Reporte Ejecutivo rediseñado** (motor HTML→PDF paginado, header/footer por página, diseño Project360 + color por cliente). **Módulo Equipo reconstruido** (Salud del equipo con datos reales + roles placeholder + funciones completas). Sprint E validado E2E + migración 015 corrida. Pendiente: KPI tarea↔Equipo, cargar reunión de Marcelo, capa 3 multi-tenant.
2026-06-19 — Sprint E completado (6 secciones, 6 commits). Equipo con personas+KPIs, sistema de Programas, KPI por tarea, onboarding editable, ROPRE en el PDF semanal, limpieza de Planeación/Métricas/Proyección. Migraciones 013/014 corridas; **pendiente: correr 015** (KPI por tarea) y walk-through E2E del flujo nuevo.
2026-06-16 — Sprint D completado. App lista para beta con 2 agencias externas. 10 commits, migración 012 + seed Mared/Ikigai en Supabase prod. Pendiente: walk-through visual E2E del CEO.
- 2026-06-12 — Workspace convertido en Cerebro. Nombre oficial confirmado: Project360 (antes "BrainSales"). Pendiente: completar en `Contexto.md` qué funciona vs. qué falta para el MVP.
