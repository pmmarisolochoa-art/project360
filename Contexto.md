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

## Pendientes de información

- [ ] Lista de qué funciona vs. qué falta para el MVP (definir con Marisol en la primera sesión de trabajo)
- [ ] ¿Hay deploy productivo en Vercel con usuarios reales? URL
- [ ] Definición de "equipo": quiénes usarán la app además de Marisol

---
*Actualizado: 2026-06-12 — creación del cerebro; datos extraídos del repo y confirmados con Marisol (nombre y prioridades).*
