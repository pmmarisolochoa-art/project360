# Playbook de Entrega — Operar Project360 para un cliente (Camino A)

> **Qué es esto:** el paso a paso de cómo operas Project360 *por dentro* para un cliente que no entra a la app (modelo Done-for-you). Lo llenas mientras lo haces. **Este documento ES el producto vendible:** cuando esté completo, puedes repetirlo con cualquier cliente sin reinventar, delegarlo a tu equipo, o convertirlo en el guion de onboarding del futuro SaaS.
>
> **Cómo usarlo:** duplica este archivo por cliente (`Playbook_<Cliente>.md`) o usa la tabla de "Bitácora por cliente" al final. Mientras operas, anota TODO en el **Registro de fricciones** — ahí vive tu backlog real.
>
> **Primer caso de prueba:** Ikigai (agencia de growth marketing, rol PM). Dolor: estrategias que se proponen y no se ejecutan.

---

## 0. Antes de empezar — Pre-flight

- [ ] ¿Tengo acceso al contexto del cliente? (marca, oferta, buyer persona, objetivos)
- [ ] ¿Tengo al menos 1 reunión / fuente de tareas reales para cargar?
- [ ] ¿Acordé con el cliente qué le voy a entregar y cada cuánto? (ej: 1 reporte ejecutivo semanal)
- [ ] ¿Definí el "alcance del piloto"? (ej: 1 proyecto/cliente suyo, 2 semanas)

**Promesa al cliente (1 frase):**
> _Yo organizo y le doy seguimiento a [proyecto/cliente] y te entrego un reporte ejecutivo cada [frecuencia]. Tú solo me pasas el contexto._

---

## 1. Cargar el cliente — Perfil / Client Brain

**Objetivo:** que la app tenga el contexto suficiente para que reportes y el Agente PM sean útiles.

| Paso | Qué hacer en la app | ✅ | Notas / fricción |
|---|---|---|---|
| 1.1 | Crear cliente en **Clientes** | ☐ | |
| 1.2 | Cargar perfil/marca, oferta y buyer persona en **Client Brain / Perfil** | ☐ | |
| 1.3 | Definir objetivo del piloto y color del cliente | ☐ | |

**Tiempo que me tomó:** ____ min · **Lo más tedioso:** ____________

---

## 2. Cargar el trabajo real — Reunión → Tareas

**Objetivo:** convertir una reunión/brief en tareas accionables en el Kanban.

| Paso | Qué hacer en la app | ✅ | Notas / fricción |
|---|---|---|---|
| 2.1 | Cargar notas/transcripción en **Notas de reunión** | ☐ | |
| 2.2 | "Extraer tareas" → revisar las que propone la IA | ☐ | |
| 2.3 | Confirmar → pasan al **Kanban de Tareas** | ☐ | |
| 2.4 | Asignar responsable y KPI/resultado esperado por tarea | ☐ | |

**Tiempo:** ____ min · **¿La IA extrajo bien las tareas?** (sí / + ajustes): ____________

---

## 3. Seguimiento — Agente PM + ROPRE

**Objetivo:** que nada se proponga y no se ejecute (el dolor exacto de Ikigai).

| Paso | Qué hacer en la app | ✅ | Notas / fricción |
|---|---|---|---|
| 3.1 | Abrir el **Agente PM** en el cerebro del cliente | ☐ | |
| 3.2 | Pedirle estado: tareas vencidas / próximas / sin responsable | ☐ | |
| 3.3 | Aprobar acciones que proponga (tareas, ROPRE, reuniones) | ☐ | |
| 3.4 | Actualizar avance de tareas (lo que se ejecutó vs lo que no) | ☐ | |

**¿El Agente PM me ahorró trabajo real o tuve que corregirlo mucho?** ____________

---

## 4. Entregable — Reporte Ejecutivo

**Objetivo:** el producto que el cliente VE y por el que pagaría.

| Paso | Qué hacer en la app | ✅ | Notas / fricción |
|---|---|---|---|
| 4.1 | Generar **Reporte Ejecutivo** (HTML→PDF) | ☐ | |
| 4.2 | Revisar que las "Decisiones" salgan de los compromisos de reunión | ☐ | |
| 4.3 | Descargar PDF y revisar diseño/coherencia | ☐ | |
| 4.4 | Enviar al cliente + breve mensaje de contexto | ☐ | |

**¿El reporte se ve lo suficientemente profesional para cobrar por él?** (sí / qué falta): ____________

---

## 5. Cierre del ciclo — Equipo y KPIs (si aplica)

| Paso | Qué hacer en la app | ✅ | Notas / fricción |
|---|---|---|---|
| 5.1 | Revisar **Salud del equipo** (cumplimiento por persona) | ☐ | |
| 5.2 | Ver KPIs de tareas completadas alimentando cada tarjeta | ☐ | |
| 5.3 | Anotar metas editadas por cliente si cambiaron | ☐ | |

---

## 📋 Registro de fricciones (tu backlog REAL)

> Cada vez que algo te trabe, te dé pena mostrárselo a un cliente, o tengas que hacerlo a mano: anótalo aquí. **No lo arregles en el momento** — primero termina el ciclo, luego priorizamos.

| Fecha | Dónde (módulo) | Qué pasó / qué faltó | Severidad (bloquea / molesta / cosmético) | ¿Lo vería un cliente? |
|---|---|---|---|---|
| 2026-06-25 | Planeación semanal + Tareas + Contenido | Salían nombres de equipo de prueba (Diego Ramírez, Camila Mora…) en vez del equipo real → **RESUELTO** (commit 66c419e + barrido) | molesta | Sí |
| 2026-06-25 | Página global "Equipo" (`/team`, menú lateral) | Muestra equipo, KPIs y bloqueos de prueba (datos falsos), no el equipo real. Construida sobre el sistema viejo de roles. **Pendiente** — rehacer aparte. | molesta | Sí (si abre esa pestaña) |
| | | | | |
| | | | | |

---

## ⏱️ Métricas del piloto (para saber si el modelo es rentable)

- **Tiempo total que me tomó operar 1 ciclo completo:** ____ horas
- **¿Cuánto de eso fue trabajo manual que la app debería automatizar?** ____ %
- **¿A qué precio/mes esto valdría la pena para mí?** $______
- **¿El cliente preguntó "¿cuánto te pago por seguir?"?** ☐ Sí ☐ No → _(si no, ¿por qué?)_

---

## 🗂️ Bitácora por cliente

| Cliente | Inicio | Estado | Entregas hechas | ¿Validó (pagaría)? |
|---|---|---|---|---|
| **Ikigai** (prueba) | 2026-06-24 | En curso | | N/A — dogfooding |
| Launch Xpert | | Pendiente contacto | | |
| Andres Alzate | | Pendiente contacto | | |

---

*Creado: 2026-06-24 · Plantilla viva — se mejora con cada ciclo. La versión "final" de este playbook es un activo del negocio.*
