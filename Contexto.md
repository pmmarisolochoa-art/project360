# Contexto — Project360

> La **fuente de verdad** de este workspace. Se mantiene vivo. El asistente lee esto antes de cualquier trabajo. **Nunca pegar credenciales aquí.**

## Qué es el proyecto

- App propia de gestión 360° para agencias/consultoras: clientes, tareas, agenda, entregables, equipo y generación IA de contenido/anuncios. Creadora y PM: Marisol. Nombre anterior: "BrainSales" (descartado — oficial: **Project360**).

## Estado actual (2026-06-12)

- Desarrollo activo: 81 commits, último el 2026-06-09 (Sprint C — generador de anuncios con 5 ángulos IA).
- Módulos existentes (por `src/pages/`): Dashboard macro, Clientes, Client Brain, Portal de cliente/funnel, Tareas, Agenda, Entregables, Links, Equipo, SOP Agent, Onboarding, Settings, Login.
- Módulos IA recientes: copies con contexto de marca, caption listo para publicar, generador de anuncios, arquitectura de marca (módulo Perfil).
- [ ] **Pendiente de definir por Marisol:** qué funciona end-to-end vs. qué falta para considerar el MVP terminado.

## Objetivo

1. MVP terminado y en uso real por Marisol y su equipo (dogfooding).
2. Base estable (bugs/UX) antes de features nuevas.
3. Luego: prepararla como SaaS vendible (onboarding, pagos, multi-cuenta).

## Activos y herramientas

- **Repo:** `~/Desktop/CLAUDE/project360/` (git, 81 commits)
- **Stack:** React + TypeScript + Vite · Tailwind · Supabase (DB/auth) · Vercel (deploy, `vercel.json`)
- **Env:** `.env.local` / `.env.example` (credenciales NUNCA en estos docs)

## Acuerdos / restricciones

- Stack fijo: no cambiar React/Supabase/Vercel.
- Marisol es PM, no desarrolladora: explicaciones en español simple, avisar antes de romper algo que funciona.
- Seguridad: revisar SIEMPRE cambios de auth/pagos.
- **Toda escritura optimista avisa al fallar.** La UI pinta el cambio antes de que Supabase confirme, así que un `.catch` con solo `console.warn` deja al usuario creyendo que guardó. Usar `onWriteError()` (`useClientStore`) o un toast equivalente. *(Un fallo mudo así ocultó durante días que no se guardaba ninguna tarea.)*
- **El seed nunca se escribe en Supabase.** Los ids del seed in-memory (`src/data/seed.ts`: `c_fitmind`, …) no son uuid y revientan contra las columnas `*_id`. Antes de persistir por `clientId`, filtrar con `isPersistableId()` (`src/utils/persistableId.ts`). El estado en memoria sí se crea: el modo local debe seguir funcionando.
- **Verificar en navegador, no solo compilar.** `typecheck` y `build` en verde no prueban que una ruta monte ni que un flujo funcione. Para cambios de UI/rutas, recorrer con Playwright MCP y revisar consola antes de pushear.

## Pendientes de información

- [ ] Lista de qué funciona vs. qué falta para el MVP (definir con Marisol en la primera sesión de trabajo)
- [ ] ¿Hay deploy productivo en Vercel con usuarios reales? URL
- [ ] Definición de "equipo": quiénes usarán la app además de Marisol

---
*Actualizado: 2026-08-03 — se añaden 3 acuerdos de ingeniería surgidos de las sesiones 30-jul/03-ago (escrituras que avisan, seed no persistible, verificar en navegador). El estado técnico vivo está en la sección "Estado" de `CLAUDE.md`; la sección "Estado actual" de aquí sigue siendo la del 12-jun.*
*Creado: 2026-06-12 — datos extraídos del repo y confirmados con Marisol (nombre y prioridades).*
