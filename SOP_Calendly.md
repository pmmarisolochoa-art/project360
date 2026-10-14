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
     "events": ["invitee.created", "invitee.canceled"],
     "organization": "<uri de tu organización>",
     "scope": "organization",
     "signing_key": "<secreto compartido con el webhook>"
   }
   ```
   `signing_key` es el secreto compartido para verificar las firmas. Debe coincidir con `CALENDLY_SIGNING_KEY` en Vercel; no se copia en el repositorio ni se comparte por chat. No asumir que aparece en la respuesta: la API permite proporcionarlo al crear la suscripción.
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

## Guardado y reintentos

La migración `calendly_reserva_atomica` añade `calendly_guardar_reserva`, una operación exclusiva del backend. Debe aplicarse antes de publicar el webhook que la usa.

- Reunión, fecha del lead y avance de etapa con historial se confirman en una sola transacción. Si falla una parte, se revierte toda esta operación. La resolución o creación inicial del lead sigue siendo un paso previo separado.
- La misma reserva se identifica por su URI de invitee de Calendly y por el cliente habilitado. La función serializa entregas simultáneas de esa reserva; una reentrega devuelve la reunión existente y no repite el historial.
- Si falla Calendly o Supabase, el webhook responde con error, en vez de confirmar una reserva que no se guardó. Calendly reintenta las entregas fallidas durante hasta 24 horas; tras fallos persistentes puede deshabilitar la suscripción. Un error de configuración requiere corregirlo, los reintentos no lo resuelven solos.
- Una cita nueva no retrocede etapas avanzadas como "Ganado". Las búsquedas de lead y closer siguen limitadas al cliente habilitado.
- El código exige exactamente un cliente configurado. Agregar otra fila sin implementar la resolución de cuenta/cliente devuelve error; no asigna todas las reservas al primer cliente.

Referencia: https://developer.calendly.com/api-docs/overview/webhooks/webhook-errors

## Cancelaciones y reprogramaciones

La migración `calendly_cancelaciones_reprogramaciones` debe aplicarse antes de publicar este bloque.

- Al recibir `invitee.canceled`, se conserva la reunión con su fecha de cancelación y motivo. Una reprogramación también conserva la reunión vieja, marcada como reprogramada, y registra la nueva por su propia URI.
- La agenda global, el espacio del closer y los contadores de próximas reuniones solo reciben citas activas. El historial de canceladas y reprogramadas está disponible en el filtro de la Agenda del cliente, con consulta sin botones de completar o eliminar.
- El lead mantiene su etapa comercial: cancelar una llamada no significa perder una venta. Se agrega la actividad al historial. Si su fecha de agenda corresponde a la llamada cancelada, se reemplaza por otra cita activa futura o queda vacía. Una cancelación antigua no borra la fecha de una reserva nueva.
- Las URI `old_invitee` y `new_invitee` enlazan las reprogramaciones. Si existe la reunión anterior se conserva el mismo lead, incluso si cambió el correo. Cuando una cancelación llega antes que la reserva, un registro exclusivo de backend impide que un aviso de creación retrasado la reactive.
- Tanto las cancelaciones como las reservas son idempotentes y se guardan con transacciones. Los errores siguen devolviendo un estado de fallo para permitir reintentos.
- El cambio no reconstruye cancelaciones históricas que Calendly nunca envió. La suscripción debe incluir los dos eventos anteriores; publicar código no cambia la suscripción real de Calendly.

### Activación y prueba operativa

1. Comprobar la suscripción real: URL del proyecto, organización/cuenta correcta, estado activo y ambos eventos (`invitee.created`, `invitee.canceled`). El código solo habilita el cliente declarado en `src/config/calendly.ts`.
2. Si hay que reemplazar una suscripción, conservar la misma signing key de forma segura y verificar el callback antes de retirar la anterior. Una clave distinta exige actualizar Vercel y desplegar; no crear suscripciones con claves incompatibles sin coordinar ese cambio.
3. Con un registro de prueba, reservar, recargar Project360 y verificar la cita y el lead. Reprogramar, recargar y comprobar que solo la cita nueva queda pendiente; la vieja aparece en el historial.
4. Cancelar la cita nueva y recargar. Confirmar que ya no aparece en agendas activas y que el lead conserva su etapa comercial y los cobros.

Referencias oficiales: https://developer.calendly.com/docs/api-guides/see-how-webhook-payloads-change-when-invitees-reschedule-events y https://developer.calendly.com/api-docs/calendly-api/webhooks/create-webhook-subscription

## Limitaciones operativas

- **Hoy solo hay un cliente y un closer habilitados.** Si Alejo suma un segundo closer agendando por Calendly, basta con cargar su email en Equipo — no hace falta tocar código. Si se conecta un cliente nuevo (no solo Alejo), hay que agregar su fila en `src/config/calendly.ts` (y probablemente sus propias credenciales de Calendly, si es una cuenta distinta).
- **Si el closer no tiene su email cargado**, la reunión se crea igual pero sin nadie asignado como participante — queda visible, se corrige a mano agregándolo.

## Para una fase futura (no construido todavía)

El payload de Calendly ya trae `utm_campaign`, `utm_source`, `utm_medium` y las respuestas a las preguntas del formulario de reserva (`questions_and_answers`) — si más adelante se decide construir atribución de campaña o costos de adquisición (como el tablero de referencia que compartió la founder), esos datos ya están disponibles en este mismo webhook, sin pedirle nada nuevo a Calendly.
