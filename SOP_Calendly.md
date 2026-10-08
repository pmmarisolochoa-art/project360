# SOP — Calendly conectado al CRM

Cómo queda conectado Calendly con Project360 para Alejo Luengas (08-oct-2026), de punta a punta.

## Qué resuelve

Antes: un lead agendaba una llamada por Calendly y esa reunión no existía en Project360 hasta que alguien la creaba a mano — sin link, sin enlace al lead, sin aparecer sola en ninguna agenda.

Ahora: al agendar, se crea sola la reunión (con el link de la llamada), aparece en la Agenda de Alejo y en "Mi Espacio" del closer, y el lead avanza a "Cita agendada" sin que nadie tenga que tocarlo.

## Setup (una sola vez — lo hace la founder o Alejo, no es código)

1. En Calendly → **Integrations & apps → API & Webhooks** → generar un **Personal Access Token** de la organización. Guardarlo.
2. Con ese token, crear la suscripción del webhook (un solo `POST`, lo hace quien tenga el token — pedir ayuda si hace falta):
   ```
   POST https://api.calendly.com/webhook_subscriptions
   Authorization: Bearer <PERSONAL_ACCESS_TOKEN>
   Content-Type: application/json

   {
     "url": "https://project360-pearl.vercel.app/api/calendly/webhook",
     "events": ["invitee.created"],
     "organization": "<uri de tu organización>",
     "scope": "organization"
   }
   ```
   La respuesta trae un campo `signing_key` — guardarlo, es el secreto que verifica que los webhooks de verdad vienen de Calendly.
3. En Vercel (Settings → Environment Variables del proyecto), agregar:
   - `CALENDLY_PERSONAL_ACCESS_TOKEN` — el del paso 1.
   - `CALENDLY_SIGNING_KEY` — el del paso 2.
4. En **Equipo** (dentro del cerebro de Alejo), confirmar que el closer que agenda por Calendly tiene su email EXACTO (el mismo con el que inició sesión en Calendly) guardado en su ficha.

## Flujo operativo (automático, ya conectado)

1. El closer comparte su link de Calendly con el lead (fuera de Project360, como ya lo hace hoy).
2. El lead reserva un horario.
3. Calendly avisa a `api/calendly/webhook.ts`. El webhook:
   - Verifica que de verdad viene de Calendly (firma).
   - Busca si el lead ya existe (por email o teléfono) dentro de Alejo. Si no existe, lo crea.
   - Trae la hora, el link de la llamada y quién la agendó (el closer).
   - Crea la reunión enlazada a ese lead.
4. La reunión aparece sola:
   - En la **Agenda de Alejo** — siempre, porque filtra por cliente.
   - En **"Mi Espacio"** del closer — si su email está cargado en Equipo. Si no, la reunión igual existe y se ve en la agenda del cliente, pero no en el espacio personal del closer hasta que se corrija su email a mano.
5. El lead pasa a **"Cita agendada"** — solo si no había avanzado ya más adelante en el embudo (un lead en "Ganado" que reagenda una llamada no retrocede).

## Gaps conocidos de v1 (aceptados a propósito, no bloqueantes)

- **Cancelar o reprogramar en Calendly no se refleja solo.** La reunión se queda marcada como agendada aunque el lead cancele; hay que corregirla a mano (borrar o editar la reunión, y el lead si hace falta). Es un gap aceptado por la founder el 08-oct-2026 para no demorar el lanzamiento — se puede cerrar después procesando también el evento `invitee.canceled` de Calendly.
- **Hoy solo hay un cliente y un closer habilitados.** Si Alejo suma un segundo closer agendando por Calendly, basta con cargar su email en Equipo — no hace falta tocar código. Si se conecta un cliente nuevo (no solo Alejo), hay que agregar su fila en `src/config/calendly.ts` (y probablemente sus propias credenciales de Calendly, si es una cuenta distinta).
- **Si el closer no tiene su email cargado**, la reunión se crea igual pero sin nadie asignado como participante — queda visible, se corrige a mano agregándolo.

## Para una fase futura (no construido todavía)

El payload de Calendly ya trae `utm_campaign`, `utm_source`, `utm_medium` y las respuestas a las preguntas del formulario de reserva (`questions_and_answers`) — si más adelante se decide construir atribución de campaña o costos de adquisición (como el tablero de referencia que compartió la founder), esos datos ya están disponibles en este mismo webhook, sin pedirle nada nuevo a Calendly.
