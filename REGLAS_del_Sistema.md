# Reglas del Sistema — Project360

> **Qué es esto.** Cómo DEBE comportarse la app, en frases comprobables. No es documentación de lo que hace: es el contrato contra el que se audita. Cuando el código y este documento no coinciden, **uno de los dos está mal** — y hay que decidir cuál, no ignorarlo.
>
> **Por qué existe.** Ninguno de los bugs de la semana del 11 al 18 de agosto fue un fallo técnico: el código compilaba, el CI estaba verde y las 69 pruebas pasaban. Eran desacuerdos entre lo que la app hacía y lo que la founder esperaba. Un auditor que solo lee código no los encuentra. Con estas reglas, sí.
>
> **Estado de cada regla:**
> `✅` verificada en producción · `⚠️` escrita pero sin comprobar · `❌` hoy se incumple (hueco conocido) · `❓` supuesto mío, la founder debe confirmar o corregir
>
> **Borrador v1 — 18 ago 2026.** Redactado por Claude a partir de lo dicho y descubierto esta semana. **Pendiente de revisión de la founder.**

---

## 1. Dónde viven las cosas

**R-01 ✅ — Una tarea es una sola fila. La vista global la muestra, la del cliente la filtra.**
Las tareas viven en el espacio general de la agencia. Al entrar por Tareas en el menú lateral salen **todas**, las de Ikigai incluidas. En el cerebro de cada cliente se ven **las suyas**. No se duplican: se reflejan. Editar en un sitio cambia el otro porque es el mismo registro.
*Se comprueba:* cambiar el estado de una tarea desde el global y verla cambiada en el cliente.

**R-02 ✅ — Lo mismo para las reuniones.** La Agenda Global las muestra todas; la agenda del cliente, las suyas.

**R-03 ✅ — La vista global no esconde nada por defecto.** Separar (clientes vs internas, por persona, por estado) es siempre una elección explícita, nunca lo que pasa solo.

**R-04 ✅ — Una reunión es interna si pertenece al cliente que representa a la agencia** (`isAgency`), no por su tipo. El tipo describe *de qué va* la reunión; *de quién es* lo dice el cliente.

**R-05 ❓ — "Personal" no es un cliente.** Una tarea personal se guarda en el Espacio de Agencia marcada como privada, porque `tasks.client_id` es obligatorio. *Confirmar que esto sigue siendo lo deseado y no un apaño.*

---

## 2. Privacidad y permisos

**R-06 ✅ — Lo privado es privado para todos, incluida la dueña de la agencia.** No aparece en vistas de equipo, ni en la global, ni en reportes, ni en los PDF. Decidido el 5 de agosto y sin excepciones — tampoco para el rol de dirección.

**R-07 ✅ — La privacidad se aplica en la base (RLS), nunca solo en el frontend.** Si la única barrera es JavaScript, no hay barrera.

**R-08 ✅ — Las policies de Postgres se SUMAN.** Añadir una policy nueva no desactiva las viejas. Toda migración que toque permisos debe enumerar las policies existentes de esa tabla y decidir explícitamente qué pasa con cada una.
*Origen:* el 10 de agosto quedaron 3 policies sin comprobación y cualquier miembro leía las reuniones privadas de la agencia.

**R-09 ✅ — Si una policy necesita mirar algo que el usuario no puede ver, va por `security definer`.** Si no, se bloquea a sí misma y el síntoma es "el dato se pierde al guardar".

**R-10 ✅ — Nadie tiene un sitio donde escribir que no pueda leer.** Dar INSERT sin SELECT produce datos que se guardan y desaparecen de la vista.

**R-11 ⚠️ — Toda regla de permisos se prueba ejecutándola con una cuenta real de ese rol.** Escribir la policy y leerla no cuenta como probarla.

**R-12 ❌ — Existe un nivel de dirección que ve todo lo del equipo sin administrarlo.**
Hoy solo hay dos niveles: dueña (todo) y miembro (solo lo suyo, redirigido a Mi Espacio). **Lorenzo (CEO) y Juan Camilo Correa (CTO) deberían ver la vista global y no pueden.** Hueco abierto.

---

## 3. Guardar datos

**R-13 ✅ — Ninguna escritura falla en silencio.** Si no se pudo guardar, el usuario se entera con un aviso que dice qué pasó. Un `console.warn` no es avisar.

**R-14 ✅ — La interfaz no canta "guardado" antes de que la base lo confirme.** En escrituras optimistas, si el guardado falla la fila optimista se retira: dejarla puesta es lo que produce el "se guardó y luego desapareció solo".

**R-15 ✅ — Cuando algo cuelga de otra cosa, lo de arriba se guarda primero y esperando.** Las tareas de una reunión no se crean hasta que la reunión existe de verdad.

**R-16 ✅ — Hay UN solo traductor por tabla** entre fila de base y objeto de la app. Dos copias se separan, y la que nadie mira se queda atrás.
*Origen:* dos traductores borraban 13 campos en cada recarga y explicaron media semana de síntomas (11 de agosto).

**R-17 ✅ — Una previsualización muestra exactamente lo que se va a guardar.** Si enseña un dato y guarda otro, no sirve para revisar, que es lo único para lo que existe.

---

## 4. Base de datos

**R-18 ✅ — El repositorio refleja la base.** Nada de columnas, policies o triggers creados a mano en la consola: si no está en una migración, la base no se puede reconstruir y cualquier migración futura puede pisar algo que no sabe que existe.

**R-19 ✅ — Añadir un valor a un tipo de TypeScript exige ampliar antes el CHECK correspondiente.** El orden importa: primero la migración, después el código que escribe. Al revés, el INSERT se rechaza y el error se pierde.
*Ha mordido tres veces.*

**R-20 ✅ — Toda migración se prueba contra una copia local del esquema real antes de pedir que se corra en producción**, y debe ser idempotente.

**R-21 ⚠️ — Una comprobación de seguridad que no se cumple es un FALLO, no un aviso.** Y una alarma que grita en falso se corrige, no se explica.

---

## 5. Integraciones

**R-22 ✅ — Lo que existe fuera y no existe aquí se rechaza; no se crea a la brava.** Un proyecto de Paralelo sin cliente declarado no se importa. Un proyecto que llega por la API pública y no existe se rechaza con 400.

**R-23 ✅ — Nada entra automáticamente. Entra lo que una persona marca.** Los datos que vienen de una transcripción no siempre aciertan; importar sin revisar mete trabajo mal asignado en la semana del equipo.

**R-24 ✅ — Lo ya procesado se muestra, en gris, no se esconde.** Una bandeja que oculta lo importado deja a quien mira sin saber si algo entró o nunca llegó — y esa duda termina en un registro creado a mano y duplicado.

**R-25 ✅ — Ante un dato ambiguo, se deja visible el dato crudo; no se adivina.** Un responsable que no se reconoce se queda con su nombre raro. Una tarea con nombre raro se corrige en dos clics porque salta a la vista; una asignada en silencio a quien no es no la corrige nadie.

**R-26 ✅ — Nunca se inventa una fecha.** Los plazos que llegan como prosa ("ASAP", "cuando vuelva Bala") no se interpretan: la fecha sale de nuestro SLA y el texto original se conserva. Una fecha inventada mete tareas falsas en "atrasadas" y ensucia el cumplimiento del equipo.

**R-27 ✅ — Las llaves de terceros viven en el servidor.** Cualquier cosa que llegue al navegador la puede leer quien abra el inspector, miembros del equipo incluidos.

**R-28 ✅ — Quien escribe en nuestra base es el usuario con su sesión, pasando por RLS.** La service key no escribe datos de negocio: se saltaría los permisos.

**R-29 ❌ — Ninguna integración depende de la sesión personal de nadie.**
Hoy Paralelo se lee con el JWT de la sesión de la founder. Funciona, pero muere cuando caduque y la app lee "como si fuera ella". Llave de servicio pedida, sin respuesta.

**R-30 ⚠️ — Una ventana de revisión que se salta datos en silencio es el peor fallo posible.** Al mirar hacia atrás se cubre con margen el peor retraso observado del proveedor.

**R-40 ❌→✅ — Dar de alta y dar acceso son cosas distintas.** Invitar a alguien que ya existe le da acceso a su ficha; no crea una segunda. Toda operación que pueda repetirse sobre la misma persona busca primero si ya está — por correo, que es la identidad de acceso, y si no por nombre dentro del cliente.
*Origen:* invitar duplicaba a todo el equipo, porque ya estaban dados de alta a mano. Quedaban dos tarjetas: una con los KPIs y otra con el acceso. Arreglado el 19 de agosto.

**R-42 ✅ — Que algo ya exista no es un conflicto: suele ser la mitad del trabajo ya hecha.** Un correo con login, una ficha creada, un proyecto ya importado — la operación se apoya en lo que hay en vez de rendirse. Solo se para cuando seguir podría dar el acceso o los datos de una persona a otra.
*Origen:* invitar duplicaba fichas (R-40) y, un nivel más abajo, se rendía si el correo ya tenía login — dejando a Roberto Maestre ininvitable desde la interfaz.

**R-44 ✅ — Una operación que se puede repetir es idempotente en TODAS sus capas, no solo en la base.** Base de datos, endpoint y lista en memoria: si una sola añade a ciegas, el duplicado aparece igual. Un duplicado que solo existe en el navegador es incluso peor, porque desaparece al recargar y parece que la base se rompió cuando no le pasa nada.
*Origen:* invitar duplicó tres veces seguidas — la ficha, el login y la lista en pantalla. Cada arreglo destapó la siguiente capa.

**R-43 ✅ — Un aviso no promete lo que no hizo.** Si a alguien no se le cambió la contraseña, no se le dice que le mandamos una: la buscaría, no le funcionaría, y acabaría escribiéndole a alguien para que lo desatasque.

**R-41 ⚠️ — Ante dos registros que podrían ser la misma persona y podrían no serlo, se para y se pregunta.** Fusionar a dos homónimos le da a alguien el acceso de otro; eso es mucho peor que una ficha de más.

---

## 6. Interfaz

**R-31 ✅ — Un botón que solo puede fallar no se muestra.** Y si algo no se puede hacer, se dice dónde el usuario lo busca, con el motivo — no en un comentario del código. Un requisito incumplido en silencio se convierte en un misterio en vez de un error.

**R-32 ❌ — Ningún control miente.** Un interruptor que solo guarda un booleano en el navegador y no conecta nada no debe existir.
*Hoy Configuración tiene 5 integraciones así.*

**R-33 ⚠️ — Un fallo parcial se cuenta con nombre y motivo.** "Se importaron algunas" deja a quien mira sin saber cuáles faltan ni si debe reintentar.

**R-34 ❓ — Los números que se muestran juntos concuerdan.** Si el KPI dice 0 clientes activos y la barra lateral dice 1, hay una sola fuente de verdad y alguien no la está usando.

---

## 7. Cómo se trabaja

**R-35 ✅ — Cuando la deducción falla dos veces, se mide.** Se imprime el dato crudo al lado del procesado en vez de razonar sobre lo que debería pasar. Los diagnósticos que encuentran algo se quedan puestos.

**R-36 ✅ — Un vacío nunca es ambiguo.** Debe poder distinguirse "no hay nada" de "algo se está comiendo los datos" sin abrir el inspector.

**R-37 ⚠️ — Nada se da por hecho hasta verificarlo en producción con datos reales.** Construido y verificado no son lo mismo; media semana de agosto se fue en descubrir que algo "construido" no funcionaba.

**R-38 ✅ — Un commit hecho no es un commit subido**, y un deploy listo no es un deploy propagado. Se comprueba, no se supone.

---

## Huecos abiertos hoy (las ❌)

| Regla | Hueco | Bloqueado por |
|---|---|---|
| R-12 | No existe el rol de dirección — Lorenzo y Juan Camilo no ven el global | Saber si ya son usuarios |
| R-29 | Paralelo se lee con la sesión personal de la founder | Respuesta de Paralelo |
| R-32 | 5 interruptores de mentira en Configuración | Pieza 3 (Google Calendar) |

## Lo que falta preguntarle a la founder

1. Las `❓` (R-05, R-34) — confirmar o corregir.
2. **Qué reglas faltan.** Esto sale de lo que ya ocurrió; seguro hay reglas tuyas que aún no se han roto y por eso no están aquí.
3. **Qué prioridad tiene cada bloque** cuando el auditor encuentre varias cosas a la vez.
