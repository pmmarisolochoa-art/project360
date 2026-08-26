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

**R-05 ⚠️ — "Personal" no es un cliente, y hoy es un PARCHE.** Una tarea personal se guarda en el Espacio de Agencia marcada como privada, porque `tasks.client_id` es obligatorio.
*Resuelto por la founder (24-ago): es un parche, NO el modelo.* Lo correcto es que una tarea pueda no tener cliente. Consecuencias mientras siga así:
· 🔴 `tasks.client_id` borra **en cascada**: si alguien borra el cliente "Ikigai Agencia", desaparecen las tareas personales de todo el equipo, sin aviso. **Falta proteger ese cliente contra borrado.**
· Cualquier informe que agrupe por cliente mete lo personal en el saco de la agencia.
*Para la plataforma nueva:* construir "sin cliente" como opción válida desde el principio. No copiar este parche.

---

## 2. Privacidad y permisos

**R-06 ✅ — Lo privado es privado para todos, incluida la dueña de la agencia.** No aparece en vistas de equipo, ni en la global, ni en reportes, ni en los PDF. Decidido el 5 de agosto y sin excepciones — tampoco para el rol de dirección.

**R-07 ✅ — La privacidad se aplica en la base (RLS), nunca solo en el frontend.** Si la única barrera es JavaScript, no hay barrera.

**R-08 ✅ — Las policies de Postgres se SUMAN.** Añadir una policy nueva no desactiva las viejas. Toda migración que toque permisos debe enumerar las policies existentes de esa tabla y decidir explícitamente qué pasa con cada una.
*Origen:* el 10 de agosto quedaron 3 policies sin comprobación y cualquier miembro leía las reuniones privadas de la agencia.

**R-09 ✅ — Si una policy necesita mirar algo que el usuario no puede ver, va por `security definer`.** Si no, se bloquea a sí misma y el síntoma es "el dato se pierde al guardar".

**R-10 ✅ — Nadie tiene un sitio donde escribir que no pueda leer.** Dar INSERT sin SELECT produce datos que se guardan y desaparecen de la vista.

**R-11 ⚠️ — Toda regla de permisos se prueba ejecutándola con una cuenta real de ese rol.** Escribir la policy y leerla no cuenta como probarla.

**R-12 ⚠️ — Existe un nivel de dirección que ve todo lo del equipo sin administrarlo.**
Tres niveles: **dueña** (todo, incluida la administración), **dirección** (CEO/CTO: lee todo lo del equipo de su agencia, no administra) y **miembro** (su espacio y sus clientes). Dirección **no ve lo privado** ni entra a Configuración, y la ruta no existe para ellos — esconder el enlace no basta, la URL se escribe a mano.
*Construido el 19-ago (migración 040), verificado en local: dirección ve los clientes de su agencia, NO ve lo privado y NO cruza a otra agencia. Pasa a ✅ cuando Lorenzo o Juan Camilo entren en producción.*

---

## 3. Guardar datos

**R-13 ✅ — Ninguna escritura falla en silencio.** Si no se pudo guardar, el usuario se entera con un aviso que dice qué pasó. Un `console.warn` no es avisar. El aviso vive en `src/store/onWriteError.ts` — uno solo, para los 8 stores.
*Historia:* la regla se estableció el 1-ago y se aplicó a 9 rutas de un store. Las otras 23, en 7 stores, quedaron fuera sin que nadie lo anotara, así que durante tres semanas parecieron cubiertas porque la regla decía que lo estaban. Las encontró la primera auditoría (18-ago) y se cerraron el 19. Ver R-39.

**R-14 ✅ — La interfaz no canta "guardado" antes de que la base lo confirme.** En escrituras optimistas, si el guardado falla la fila optimista **se retira**: dejarla puesta es lo que produce el "se guardó y luego desapareció solo". El aviso solo mitiga — una fila fantasma en pantalla es indistinguible de una real, y se sigue trabajando encima. Las piezas para deshacer están en `src/store/escrituraOptimista.ts`.
*Excepción, y solo esta:* los autoguardados con retardo de algo que la persona está ESCRIBIENDO (proyecciones, asignación de roles) **no revierten** — le borrarían de la pantalla lo que acaba de teclear. Ahí el aviso dice la verdad completa: no se guardó, sigue ahí, y se pierde al recargar.
*Historia:* durante tres semanas, de 30 rutas de escritura solo UNA se deshacía. Lo encontró el auditor el 21-ago; se cerró el 25.

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

**R-47 ✅ — Todo lo que existe tiene una puerta.** Si un espacio, una vista o un dato son reales, se llega a ellos haciendo clic. Escribir la URL a mano no cuenta como llegar: para quien usa la app, lo que no tiene enlace no existe.
*Origen:* el espacio de la agencia se filtra de Clientes, del Dashboard y del menú por no ser un cliente real — pero tiene equipo, agenda y tareas internas, y no había forma de entrar.

**R-31 ✅ — Un botón que solo puede fallar no se muestra.** Y si algo no se puede hacer, se dice dónde el usuario lo busca, con el motivo — no en un comentario del código. Un requisito incumplido en silencio se convierte en un misterio en vez de un error.

**R-32 ❌ — Ningún control miente.** Un interruptor que solo guarda un booleano en el navegador y no conecta nada no debe existir.
*Hoy Configuración tiene 5 integraciones así.*

**R-33 ⚠️ — Un fallo parcial se cuenta con nombre y motivo.** "Se importaron algunas" deja a quien mira sin saber cuáles faltan ni si debe reintentar.

**R-34 ⚠️ — Los números que se muestran juntos concuerdan.** Si el KPI dice 0 clientes activos y la barra lateral dice 1, hay una sola fuente de verdad y alguien no la está usando.
*Cómo se audita (24-ago):* contra el **Glosario de Métricas**, que define cada número que la app muestra. Sin él la regla no era comprobable — solo se podía ver que dos números difieren, no cuál estaba mal.
*Al escribir el glosario aparecieron 4 desajustes vivos:* el "de N totales" de Clientes activos incluye a la agencia y el numerador no · "vencida" sale de una marca guardada que escribe el navegador, no de comparar fechas · la salud del cliente recibe *pendientes de hoy* donde su propia función espera *vencidas* · "Tareas a tiempo %" se divide entre todas las tareas, no entre las entregadas.

---

**R-39 ✅ — Una regla aplicada a medias es peor que no tenerla**, porque da por seguro lo que no lo está. Cuando una regla se aplica a parte del código, lo que queda fuera se escribe en el mismo commit y sigue en el informe hasta cerrarse.
*Origen:* las 23 rutas de escritura mudas que sobrevivieron tres semanas a su propia regla.

---

**R-49 ✅ — El responsable de una tarea es una PERSONA, y se elige de una lista.**
Nunca un rol, nunca un equipo, nunca texto escrito a mano. Si algo llega como
rol (la IA de reuniones, el agente PM, las plantillas de embudo, el onboarding
de un cliente), se traduce a la persona que ejerce ese rol **en ese cliente y al
GUARDAR** — no al pintar. Si no se puede resolver sin ambigüedad (nadie lo tiene,
o lo tienen dos), queda **Sin asignar**.
*Origen:* la lista "Todas las personas" llegó a mostrar **34 nombres para 13
personas**: apodos del histórico, "Speaker A", y slugs como `platforms`,
`expert` y `designer` — que ofrecía el propio desplegable como "🏷️ Por rol". Se
veían bien en la tarjeta porque había un traductor al pintar, pero los KPIs
buscan el nombre exacto: **esas tareas no contaban para nadie y media plantilla
llevaba meses mal medida.**
*Se comprueba:* que ningún `tasks.assigned_to` deje de coincidir con una ficha de
`team_members`. Hoy: 0.

## 7. Cómo se trabaja

**R-35 ✅ — Cuando la deducción falla dos veces, se mide.** Se imprime el dato crudo al lado del procesado en vez de razonar sobre lo que debería pasar. Los diagnósticos que encuentran algo se quedan puestos.

**R-36 ✅ — Un vacío nunca es ambiguo.** Debe poder distinguirse "no hay nada" de "algo se está comiendo los datos" sin abrir el inspector.

**R-37 ⚠️ — Nada se da por hecho hasta verificarlo en producción con datos reales.** Construido y verificado no son lo mismo; media semana de agosto se fue en descubrir que algo "construido" no funcionaba.

**R-48 ✅ — Un store que no habla con la base no puede decir "guardado".** Si algo vive solo en memoria, la interfaz lo dice o no lo dice, pero no promete lo contrario. Y antes de construirle persistencia a un módulo, la primera pregunta es si se usa: uno que no se usa y además miente es peor que uno que no existe.
*Origen:* Planeación y el Agente SOP cantaban "guardado" y no escribían en ningún sitio — ni repositorio, ni tabla, ni `localStorage`. Los encontró el auditor el 21-ago; la founder confirmó que no se usaban y se retiraron el 25.

**R-45 ✅ — Una función no está hecha hasta que su resultado sobrevive y llega a quien tiene que leerlo.** Verse bien en pantalla es la mitad: si no aguanta una recarga, no se puede descargar y no llega a nadie, no está terminada.
*Origen:* el reporte de la Daily se dio por listo cuando se veía bien. Vivía solo en memoria (desaparecía al recargar, costaba otra llamada de IA cada vez, y cada persona veía el suyo), el PDF salía en blanco porque el botón llamaba al reporte viejo, y no había forma de enviarlo. El contenido estaba bien; la entrega no existía.

**R-46 ✅ — Lo que la app calcula y lo que la app opina se distinguen a simple vista.** El lector tiene que poder saber qué es dato y qué es interpretación sin preguntar. En el reporte de la Daily las secciones que escribe la IA llevan la marca "lectura"; los conteos no.

**R-50 ✅ — Antes de construir un entregable se pregunta QUIÉN LO RECIBE y qué hace con él, no qué formato quiere.** El formato es una consecuencia; el destinatario es el dato. Los mismos datos para una persona que los lee y para un sistema que los importa son dos entregables opuestos, y ninguno sirve a medias para el otro.
*Origen:* el 26-ago se construyó importar cuando hacía falta exportar, y después un Excel legible cuando hacía falta un paquete técnico con ids. Tres entregas para un encargo, y las tres preguntas que se hicieron fueron sobre el formato.

**R-51 ✅ — Un envío es UN archivo.** Si una entrega necesita varias piezas, van juntas y comprimidas. El navegador bloquea la segunda descarga automática de una página, así que "bajar dos archivos" significa en la práctica bajar el primero y perder el resto sin ningún aviso.
*Origen:* el paquete de traspaso bajaba el JSON y perdía el `LEEME.md` —la mitad del entregable— en silencio. Lo mismo con los CSV de varias tablas: llegaba uno de cuatro.

**R-52 ✅ — Un archivo que se entrega dice lo que NO lleva.** Las filas excluidas se cuentan y las tablas omitidas se nombran. Quien recibe un archivo incompleto que calla su hueco no sospecha: concluye. "Esta agencia no usa embudos" es una conclusión falsa sacada de un archivo al que le faltaba una tabla a propósito.
*Origen:* el paquete de traspaso del 26-ago, donde se acordó con Ikigai dejar fuera cuatro tablas que su servidor ya gestiona.

**R-38 ✅ — Un commit hecho no es un commit subido**, y un deploy listo no es un deploy propagado. Se comprueba, no se supone.

---

## Huecos abiertos hoy (las ❌)

| Regla | Hueco | Bloqueado por |
|---|---|---|
| R-12 | No existe el rol de dirección — Lorenzo y Juan Camilo no ven el global | Saber si ya son usuarios |
| R-29 | Paralelo se lee con la sesión personal de la founder | Respuesta de Paralelo |
| R-32 | 5 interruptores de mentira en Configuración | Pieza 3 (Google Calendar) |

## Lo que falta preguntarle a la founder

1. ~~Las `❓` (R-05, R-34)~~ — **resueltas el 24-ago.** R-05 es parche declarado; R-34 se audita contra el Glosario de Métricas.
2. **Qué reglas faltan.** Esto sale de lo que ya ocurrió; seguro hay reglas tuyas que aún no se han roto y por eso no están aquí.
3. **Qué prioridad tiene cada bloque** cuando el auditor encuentre varias cosas a la vez.
