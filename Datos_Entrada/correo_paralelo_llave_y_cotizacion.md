# Correo a Paralelo — llave de servicio + cotización de la integración

**Estado:** borrador listo para enviar (13-ago-2026).
**Para:** [contacto técnico de Paralelo]
**CC:** [quien lleve la relación comercial]
**Asunto:** Integración Project360 ↔ Paralelo — llave de API de servicio y cotización

---

Hola [nombre],

Les escribo para cerrar dos puntos de la integración entre Paralelo y Project360
(nuestra app interna de gestión), y de paso resolver algo técnico que nos frena.

**1. Necesitamos una llave de API de servicio (esto es lo urgente)**

Hoy estamos leyendo su API con el token de mi sesión de usuario —el JWT que
emite `ikigaigm.meetico.parallelo.ai` al entrar a la plataforma—. Nos sirvió
para desarrollar y probar, pero no aguanta producción: es mi sesión personal, y
cuando caduque la integración se cae sin aviso.

¿Nos pueden emitir una **llave de API de servicio**, no ligada a un usuario?
Lo que necesitamos:

- Alcance de **solo lectura**, y solo sobre lo que ya usamos:
  `GET /meetings` y `GET /meetings/reports/query`.
- Sin vencimiento, o con uno largo y avisándonos antes de rotarla.
- Si no manejan llaves de servicio, nos sirve saberlo igual: ajustamos el
  diseño para renovar el token, pero preferimos no hacerlo si ustedes ya
  tienen la pieza correcta.

**2. ¿Paralelo ya trae módulo de integraciones o webhooks?**

Antes de pedirles desarrollo, la pregunta obvia: ¿la plataforma ya permite
configurar un webhook o una integración saliente —por ejemplo, avisar a una URL
nuestra cuando una reunión termina de procesarse—?

Si ya existe, esto es configuración y no desarrollo, y nos ahorramos el punto 3.

**3. Cotización y tiempos del lado de ustedes**

Si no existe, sí necesitamos desarrollo de su lado y quisiera **cotización y
tiempo estimado**. El alcance, para que puedan dimensionarlo:

- Que Paralelo consuma nuestra API pública (`/api/v1/`) para crear y actualizar
  tareas en Project360.
- El emparejamiento se hace por `external_id` — nosotros ya lo soportamos y es
  idempotente, así que reenviar la misma tarea no duplica.
- La llave de **solo lectura** y la documentación (`API_PUBLICA.md`) ya se las
  entregamos el 6 de agosto. La llave con permiso de **escritura** la emitimos
  cuando la lectura esté funcionando de su lado.

Una regla nuestra que conviene tener clara desde ya: un proyecto que exista en
Paralelo y no en Project360 se rechaza con un 400, no se crea automáticamente.

Quedo atenta. Con el punto 1 resuelto ya podemos empezar a operar la parte que
depende de nosotros.

Gracias,
Marisol Ochoa
Ikigai
