# API Pública de Project360 — v1

Documentación para desarrolladores externos.

Esta API permite leer y crear **tareas** y **reuniones (agenda)** de una agencia
dentro de Project360. Está pensada para integraciones de servidor a servidor.

> **Estado:** v1. Solo Tareas y Agenda. Clientes, métricas, entregables, equipo
> y ROPRE **no** están expuestos y no hay fecha para ello.

---

## 1. Obtener una API key

Las llaves las emite la dueña de la agencia desde
**Configuración → API y Desarrolladores → Generar nueva API Key**.

Al pedirla, indícale:

- **Nombre de tu aplicación** (para que la reconozca en su panel).
- **Qué permisos necesitas.** Pide el mínimo: si solo vas a leer, no pidas
  escritura. Siempre se puede emitir otra llave después.
- **Cuántas llamadas por minuto** estimas.

Recibirás una llave con este formato:

```
pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

⚠️ **Se muestra una sola vez.** El servidor guarda únicamente un hash, así que
nadie —ni el equipo de Project360— puede recuperarla después. Si se pierde, hay
que revocarla y emitir una nueva.

**Guárdala como una contraseña:** en variables de entorno de tu servidor, nunca
en el código fuente, nunca en un repositorio, nunca en el navegador.

---

## 2. Autenticación

Manda la llave en la cabecera `Authorization` de **cada** llamada:

```
Authorization: Bearer pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**La API no se puede llamar desde un navegador.** No emite cabeceras CORS a
propósito: hacerlo te obligaría a poner la llave en el JavaScript de una página
web, o sea, a publicarla. Llámala desde tu backend.

Todas las llamadas deben ser **HTTPS**.

---

## 3. URL base

```
https://<dominio-de-project360>/api/v1
```

La versión va en la ruta (`/v1/`). Cuando salga una v2, la v1 seguirá
funcionando: tu integración no se romperá sola.

---

## 4. Formato de las respuestas

**Éxito:**

```json
{
  "success": true,
  "data": { }
}
```

**Error:**

```json
{
  "success": false,
  "error": {
    "code": "permiso_insuficiente",
    "message": "Esta API key no tiene el permiso \"write:tasks\"."
  }
}
```

Programa contra el campo `code`, no contra `message`: los códigos son parte del
contrato y no cambian, los mensajes pueden reescribirse para que se lean mejor.

---

## 5. Endpoints

### 5.1 Listar tareas

```
GET /api/v1/tasks
```

**Permiso:** `read:tasks`

**Parámetros** (todos opcionales):

| Parámetro   | Tipo   | Descripción |
|-------------|--------|-------------|
| `client_id` | uuid   | Filtra por cliente |
| `status`    | texto  | `pending`, `in_progress`, `in_review`, `completed`, `blocked` |
| `desde`     | fecha  | Fecha límite mínima (ISO) |
| `hasta`     | fecha  | Fecha límite máxima (ISO) |
| `limite`    | número | 1–200. Por defecto 50 |
| `offset`    | número | Para paginar. Por defecto 0 |

**Respuesta:**

```json
{
  "success": true,
  "data": {
    "tareas": [
      {
        "id": "a3f1…",
        "client_id": "b7c2…",
        "cliente": "Andrea Torres",
        "titulo": "Grabar VSL de la oferta",
        "descripcion": "Versión de 8 minutos",
        "estado": "in_progress",
        "prioridad": "P1",
        "asignado_a": "Juan Camilo",
        "fecha_limite": "2026-08-20T00:00:00.000Z",
        "completada_en": null,
        "etiqueta": "video",
        "external_id": null,
        "origen": "manual",
        "meeting_id": "c9d3…",
        "creada_en": "2026-08-01T14:20:00.000Z"
      }
    ],
    "paginacion": { "limite": 50, "offset": 0, "hay_mas": false }
  }
}
```

`hay_mas` te dice si vale la pena pedir la página siguiente. No se devuelve un
total: contarlo obligaría a recorrer toda la tabla en cada llamada.

---

### 5.2 Obtener una tarea

```
GET /api/v1/tasks/:id
```

**Permiso:** `read:tasks` · **Respuesta:** `{ "tarea": { … } }`

Si la tarea no existe, o no pertenece a tu agencia, la respuesta es **404** en
los dos casos.

---

### 5.3 Crear una tarea

```
POST /api/v1/tasks
```

**Permiso:** `write:tasks`

```json
{
  "client_id": "b7c2…",
  "titulo": "Revisar creativos de la campaña",
  "descripcion": "Los 5 ángulos nuevos",
  "prioridad": "P2",
  "asignado_a": "Marcela",
  "fecha_limite": "2026-08-25",
  "etiqueta": "ads",
  "external_id": "PARALELO-1234"
}
```

| Campo | Obligatorio | Notas |
|---|---|---|
| `client_id` | **sí** | uuid del cliente. Sácalo de `GET /tasks` |
| `titulo` | **sí** | Máx. 300 caracteres |
| `descripcion` | no | Máx. 5000 |
| `prioridad` | no | `P1`, `P2`, `P3`. Por defecto `P2` |
| `asignado_a` | no | Nombre de la persona. Por defecto "Sin asignar" |
| `fecha_limite` | no | ISO. Por defecto, dentro de 7 días |
| `etiqueta` | no | Máx. 60 |
| `external_id` | no | **Recomendado.** El id en tu sistema |

**Respuesta:** `201` con la tarea completa.

#### Sobre `external_id` — léelo antes de integrar

Es la pieza clave del emparejamiento entre los dos sistemas y **evita
duplicados**:

- Si mandas un `external_id` que **ya existe** para ese cliente, la API
  **devuelve la tarea que ya había** en vez de crear otra. Un reintento tuyo
  (timeout, reenvío, reinicio de tu worker) no llena el tablero de copias.
- Las tareas creadas dentro de Project360 tienen `external_id: null`. Para
  emparejarlas con las tuyas: léelas con `GET /tasks`, guarda sus `id`, y
  cuando las actualices con `PATCH` quedan asociadas.

La tarea creada por API queda marcada con `origen: "api"`.

---

### 5.4 Cambiar el estado de una tarea

```
PATCH /api/v1/tasks/:id/status
```

**Permiso:** `write:tasks`

```json
{ "estado": "completed" }
```

Valores: `pending`, `in_progress`, `in_review`, `completed`, `blocked`.

**Este endpoint solo cambia el estado.** No puede modificar el título, la fecha
ni el responsable — es deliberado: una integración con un error no debe poder
reescribir el trabajo del equipo.

**Respuesta:**

```json
{
  "success": true,
  "data": { "tarea": { }, "estado_anterior": "in_progress" }
}
```

⚠️ **Las tareas en `in_review` no se pueden mover desde la API** → responde
`409`. La revisión es un proceso interno de Project360. Si tu sistema tiene la
tarea como terminada y recibes un 409, déjala como está: alguien la está
revisando.

**¿No tienes un estado equivalente?** Si en tu sistema la tarea está
"Cancelada", mándala como `blocked` — no inventes un estado nuevo.

---

### 5.5 Listar reuniones

```
GET /api/v1/meetings
```

**Permiso:** `read:meetings`

Parámetros: `client_id`, `desde`, `hasta`, `limite`, `offset` (igual que tareas;
`desde`/`hasta` filtran por fecha programada).

```json
{
  "id": "c9d3…",
  "client_id": "b7c2…",
  "cliente": "Andrea Torres",
  "titulo": "Weekly de métricas",
  "tipo": "weekly_metrics",
  "programada_en": "2026-08-12T15:00:00.000Z",
  "duracion_min": 45,
  "participantes": [],
  "agenda": "Revisar CPL de la semana",
  "enlace_videollamada": "https://meet.google.com/…",
  "completada": false,
  "origen": "manual",
  "creada_en": "2026-08-05T10:00:00.000Z"
}
```

**La API no devuelve transcripciones, notas internas ni tareas extraídas de la
reunión.** Es una decisión de privacidad: son conversaciones literales del
equipo y del cliente.

---

### 5.6 Obtener una reunión

```
GET /api/v1/meetings/:id
```

**Permiso:** `read:meetings`

---

### 5.7 Crear una reunión

```
POST /api/v1/meetings
```

**Permiso:** `write:meetings`

```json
{
  "client_id": "b7c2…",
  "titulo": "Kickoff del lanzamiento",
  "tipo": "kickoff",
  "programada_en": "2026-08-18T16:00:00Z",
  "duracion_min": 60,
  "agenda": "Alcance y fechas",
  "enlace_videollamada": "https://meet.google.com/…"
}
```

**Tipos válidos:** `kickoff`, `weekly_metrics`, `content_strategy`,
`ads_review`, `monthly_closing`, `crisis`, `weekly_planning`, `ropre_strategy`,
`weekly_closing`, `general`, `management`.

Un tipo fuera de esta lista devuelve `400` con los valores permitidos.

---

## 6. Códigos de error

| HTTP | `code` | Qué pasó | Qué hacer |
|---|---|---|---|
| 400 | `datos_invalidos` | Falta un campo, tiene formato malo, o mandaste uno que no existe | Lee `message`: dice qué campo |
| 400 | `https_requerido` | Llamaste por HTTP | Usa HTTPS |
| 400 | `no_encontrado` | El `client_id` no existe en Project360 | Ese cliente no está dado de alta. Habla con la agencia |
| 401 | `no_autenticado` | No mandaste la cabecera `Authorization` | Añádela |
| 401 | `key_invalida` | La llave no existe o fue revocada | Pide una nueva |
| 401 | `key_expirada` | La llave venció | Pide una nueva |
| 403 | `permiso_insuficiente` | Tu llave no tiene ese permiso | Pide que te lo añadan (implica llave nueva) |
| 404 | `no_encontrado` | El recurso no existe o no es de tu agencia | Verifica el id |
| 405 | `metodo_no_permitido` | Método incorrecto en esa ruta | Revisa la cabecera `Allow` |
| 409 | `datos_invalidos` | Tarea en revisión | No la toques |
| 413 | `payload_muy_grande` | Body de más de 100 KB | Divídelo |
| 429 | `demasiadas_solicitudes` | Superaste tu límite | Espera lo que diga `Retry-After` |
| 500 | `error_interno` | Fallo de nuestro lado | Reintenta; si sigue, avisa |

**Importante sobre el 400 con `no_encontrado` en un `POST`:** significa que el
cliente al que intentas escribir no existe en Project360. Es lo que pasa con
proyectos que existen en tu sistema pero no en el suyo. **No lo ignores** — esa
tarea no se guardó en ningún lado.

**Sobre el 404:** un recurso de otra agencia devuelve 404, no 403. Es a
propósito: un 403 confirmaría que ese id existe.

**Sobre el orden de los errores:** sin una llave válida siempre recibes `401`,
aunque además el método o los datos estén mal. La API se autentica primero y
solo después mira el resto — a quien no se ha identificado no se le cuenta qué
métodos existen.

---

## 7. Límites de uso

Cada llave tiene su límite por minuto (60, 100 o 300, lo elige la agencia).

Al pasarte recibes `429` con la cabecera `Retry-After: 60`. **Espera esos
segundos y reintenta** — no reintentes de inmediato ni en bucle: cada intento
cuenta y prolonga el bloqueo.

Otros límites: **body máximo 100 KB**, **200 resultados** por página.

---

## 8. Ejemplos

### curl

```bash
# Listar tareas pendientes de un cliente
curl -s "https://tu-dominio.com/api/v1/tasks?status=pending&limite=20" \
  -H "Authorization: Bearer $PROJECT360_API_KEY"

# Crear una tarea
curl -s -X POST "https://tu-dominio.com/api/v1/tasks" \
  -H "Authorization: Bearer $PROJECT360_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "b7c2…",
    "titulo": "Revisar creativos",
    "external_id": "PARALELO-1234"
  }'

# Marcar como completada
curl -s -X PATCH "https://tu-dominio.com/api/v1/tasks/a3f1…/status" \
  -H "Authorization: Bearer $PROJECT360_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"estado": "completed"}'
```

### JavaScript (Node)

```js
const BASE = 'https://tu-dominio.com/api/v1';
// La llave sale del entorno, NUNCA del código.
const KEY = process.env.PROJECT360_API_KEY;

async function api(ruta, opciones = {}) {
  const res = await fetch(`${BASE}${ruta}`, {
    ...opciones,
    headers: {
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      ...opciones.headers,
    },
  });

  const cuerpo = await res.json();

  if (!cuerpo.success) {
    // Respeta el rate limit en vez de insistir.
    if (res.status === 429) {
      const espera = Number(res.headers.get('Retry-After') ?? 60);
      await new Promise((r) => setTimeout(r, espera * 1000));
      return api(ruta, opciones);
    }
    throw new Error(`[${cuerpo.error.code}] ${cuerpo.error.message}`);
  }

  return cuerpo.data;
}

// Listar
const { tareas } = await api('/tasks?status=pending');

// Crear (idempotente: repetirlo con el mismo external_id no duplica)
const { tarea } = await api('/tasks', {
  method: 'POST',
  body: JSON.stringify({
    client_id: 'b7c2…',
    titulo: 'Revisar creativos',
    external_id: 'PARALELO-1234',
  }),
});

// Cambiar estado, respetando el 409 de "en revisión"
try {
  await api(`/tasks/${tarea.id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ estado: 'completed' }),
  });
} catch (e) {
  if (String(e).includes('revisión')) {
    console.log('Está en revisión del lado de la agencia: se deja como está.');
  } else {
    throw e;
  }
}
```

---

## 9. Buenas prácticas

1. **Guarda la llave en variables de entorno.** Nunca en el código ni en git.
2. **Pide el permiso mínimo.** Empieza con solo lectura y añade escritura cuando
   la integración esté probada.
3. **Usa siempre `external_id` al crear.** Es lo que hace que un reintento no
   duplique.
4. **Respeta el `Retry-After`.**
5. **No ignores los 400.** Un 400 significa que eso **no se guardó**.
6. **Guarda los `id` de Project360** que te devuelva: son los que necesitas para
   actualizar después.
7. **Si la llave se filtra, pide que la revoquen de inmediato.** Deja de
   funcionar al instante.

---

## 10. Privacidad

Hay dos cosas que la API **nunca** devuelve, sin importar qué permisos tenga tu
llave:

- **Tareas y reuniones marcadas como privadas.** Pertenecen al espacio personal
  de un miembro del equipo.
- **Transcripciones, notas internas y tareas extraídas** de las reuniones.

Y tu llave solo ve datos de **una agencia**: la que la emitió.

---

## 11. Soporte

Escribe a la persona que te dio la llave. Ten a mano:

- El **prefijo** de tu llave (`pk_live_a1b2…`), nunca la llave completa.
- La **hora aproximada** de la llamada que falló.
- El `code` y el `message` que recibiste.

Con eso puede encontrar tu llamada exacta en el panel de actividad.
