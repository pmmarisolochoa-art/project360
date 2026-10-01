# Conectar ManyChat (y WhatsApp si corre por ManyChat) a Ventas

Mismo endpoint que ya usa el Apps Script del Sheet: `POST /api/v1/leads`.
Genérico — sirve para cualquier cliente, solo cambia la API key y el
`client_id` del payload.

> **Si tu WhatsApp corre DENTRO de ManyChat** (canal WhatsApp de ManyChat,
> no una integración aparte tipo GHL/Twilio): es exactamente el mismo flujo
> de abajo, solo que el Flow se dispara desde el canal WhatsApp en vez del
> de Instagram/Messenger. Si tu WhatsApp es una herramienta distinta,
> avísame cuál — ese es un conector aparte, todavía no construido.

## 1. Consigue la API key

Configuración → API y Desarrolladores → Generar nueva API Key → permiso
**`write:leads`** únicamente. Cópiala apenas aparezca, se ve una sola vez.

## 2. En ManyChat: acción "External Request"

Dentro del Flow que captura el lead (el que corre después de que alguien
comenta/escribe/llena tu formulario de ManyChat):

1. Agrega una acción **"External Request"** (a veces aparece como
   "Request URL" según el plan).
2. **Method:** `POST`
3. **URL:**
   ```
   https://project360-pearl.vercel.app/api/v1/leads
   ```
4. **Headers:**
   ```
   Authorization: Bearer pk_live_TU_KEY_AQUI
   Content-Type: application/json
   ```
5. **Body (raw JSON)** — usa las variables de ManyChat entre `{{ }}` que
   correspondan a tu Flow (los nombres exactos dependen de tus Custom User
   Fields, ajústalos):
   ```json
   {
     "client_id": "e102eb72-232e-4884-b116-3cc473ed150e",
     "nombre": "{{full_name}}",
     "telefono": "{{phone}}",
     "email": "{{email}}",
     "fuente": "otro",
     "external_id": "{{user_id}}"
   }
   ```

## Campos del body

| Campo | Obligatorio | Nota |
|---|---|---|
| `client_id` | sí | fijo por Flow — el cliente al que pertenece este bot |
| `nombre` | sí | si ManyChat no capturó nombre, usa `{{first_name}} {{last_name}}` |
| `telefono` / `email` | no | lo que tu Flow haya recolectado |
| `fuente` | no (default `otro`) | ponlo **fijo** según de dónde sale el Flow — no es una variable de ManyChat: `reel` si el Flow arranca de un comentario en Reel, `story` si es de una Story, `perfil` si es DM directo al perfil, `otro` si no aplica ninguno |
| `external_id` | recomendado | **usa `{{user_id}}`** (el id del suscriptor en ManyChat) — así un reintento del Flow (p. ej. si el usuario vuelve a escribir la palabra clave) no crea un lead duplicado; la API es idempotente por este campo |
| `perfil_rol` | no | si tienes un Custom Field que captura quién es el comprador |

## 3. Probar

ManyChat trae un botón "Test Request" / "Send Test" en la propia acción —
úsalo antes de publicar el Flow. Si responde `201` con un `data.lead.id`,
quedó bien. Si responde `401`, revisa la key (sin espacios de más al
pegarla — fue el bug real que tumbó el Sheet de Alejo el 30-sep). Si
responde `400`, el mensaje dice qué campo viene mal.

## 4. Verificar que llegó

En Project360 → cerebro del cliente → Ventas, el lead aparece en la
columna "Nuevo" del Pipeline apenas ManyChat dispara el request — no hay
demora como con el Sheet (ahí no hay que esperar los 10 min del Apps
Script, el webhook es instantáneo).
