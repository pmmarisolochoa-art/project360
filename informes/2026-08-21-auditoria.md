# Auditoría — 21 de agosto de 2026

## Resumen

**Dos módulos del cerebro del cliente dicen "guardado" y no guardan nada: Planeación (embudos) y el Agente SOP.** No fallan al escribir — no escriben. Ningún `console.warn`, ninguna tabla, ninguna migración. Por eso la auditoría del 18 no los vio: buscaba escrituras que fallan, y aquí no hay escritura. Además, el rol de dirección quedó a medias en la interfaz: ve botones de edición que la base rechaza, y dos módulos vacíos sin motivo.

---

## Hallazgos nuevos

### [1 · Pérdida de datos] Dos módulos cantan "guardado" y viven solo en memoria

**Dónde:**
- `src/store/useFunnelStore.ts:14-16` — los tres métodos son `set(...)` y nada más. Consumido por `src/components/brain/modules/PlanningModule.tsx:196-199` (**Planeación**, pestaña 2 de las 9 del cerebro de todos los clientes).
- `src/store/useSopStore.ts:13-15` — igual. Consumido por `src/pages/SopAgentPage.tsx:66`.

**Medido:**
- `grep "Repo\|services\|persist\|localStorage"` sobre los dos archivos → **0 coincidencias**. No hay repositorio, no hay `persist`, no hay `localStorage`.
- `grep -rln "funnel_docs" supabase/` → **la tabla no existe en ninguna migración.**
- `grep -rn "useFunnelStore" src/services/bootstrap.ts` → **0**. Nada los hidrata al arrancar.

**Qué pasa:**
1. La founder entra a un cliente → **Planeación** → "Crear embudo" → elige el tipo. Sale el toast **`Embudo "Lanzamiento" creado`** (`PlanningModule.tsx:209`), aparece la tarjeta, edita los nodos. Recarga la página, o simplemente vuelve mañana: **no hay nada**. El módulo dice *"Aún no hay embudos. Crea uno para empezar."* — el mismo vacío que si nunca hubiera entrado.
2. En el Agente SOP responde **las 25 preguntas** de un prospecto, pulsa generar, y lee **`Análisis guardado`** (`SopAgentPage.tsx:68`). Recarga: se perdieron las 25 respuestas y el informe. Volver a hacerlo cuesta otra llamada de IA y otro rato de la founder.

Esto es peor que una escritura que falla: una escritura fallida al menos deja rastro en la consola y, desde el 19 de agosto, un aviso en pantalla. Aquí **el camino feliz y el de la pérdida total son el mismo camino**, y el mensaje que se lee es de éxito.

**Ojo con el nombre.** Hay dos stores de embudos y solo uno persiste: `useFunnelLaunchStore` (embudos de lanzamiento, con `FunnelLaunchRepo`, hidratado en el bootstrap) sí guarda. `useFunnelStore` (constructor visual de Planeación) no. Se llaman casi igual y viven al lado — es exactamente el patrón de "la segunda copia que nadie mira" que ya costó media semana el 11 de agosto.

**Regla:** R-45 (una función no está hecha hasta que su resultado sobrevive), R-14 (la interfaz no canta guardado antes de que la base confirme), R-36 (un vacío nunca es ambiguo).

**Propuesta.** Son dos decisiones distintas, y **la primera es de producto, no técnica: ¿se usan estos dos módulos?** Si la respuesta es no, la respuesta correcta es quitarlos del nav, no construirles una tabla — un módulo que no se usa y además miente es peor que uno que no existe.

Si sí se usan:
- **Planeación** → tabla `funnel_docs` (`client_id`, `kind`, `doc` jsonb con nodos y aristas), repositorio y las tres rutas por `onWriteError`. El documento entero cabe en un jsonb; no hace falta modelar nodos y aristas en columnas.
- **SOP** → tabla `sop_assessments` (`agencia_id`, prospecto, respuestas jsonb, informe, decisión).

**Qué se rompería si se hace mal:** hoy estos stores no filtran por agencia porque nunca salen del navegador. Al llevarlos a la base, si la policy se copia de `content_via_client` heredan "solo la dueña", y el SOP no cuelga de un cliente — necesita `agencia_id` propio. Y R-19: si `kind` va a una columna con CHECK, el CHECK se amplía **antes** que el código.

---

### [1 · Pérdida de datos] La fila optimista solo se retira en 1 de las 30 rutas de escritura

**Dónde:** 30 rutas con `onWriteError` en 8 stores. **Una sola revierte**: `src/store/useClientStore.ts:101` (`addTask`).

| Store | Rutas | Revierten |
|---|---|---|
| `useClientStore.ts` | 9 | 1 (`addTask`) |
| `useFunnelLaunchStore.ts` | 5 | 0 |
| `useRopreStore.ts` | 3 | 0 |
| `useProgramsStore.ts` | 3 | 0 |
| `useContentStore.ts` | 3 | 0 |
| `useTeamMembersStore.ts` | 3 | 0 |
| `useTeamStore.ts` | 2 | 0 |
| `useProjectionStore.ts` | 2 | 0 |

**Qué pasa:** alguien crea un riesgo en el ROPRE. La base lo rechaza. Ahora salta el aviso — eso se arregló el 19 y funciona. Pero **la tarjeta del riesgo sigue ahí, en pantalla, indistinguible de las que sí se guardaron.** Si en ese momento hay tres avisos seguidos (ver el hallazgo de "Copiar equipo"), no hay forma de saber cuál de las tarjetas es la fantasma. Se sigue trabajando encima de ella, se la menciona en la reunión, y desaparece en la siguiente recarga.

El aviso mitiga, no cierra: siete de los treinta mensajes dicen *"Recarga para ver el estado real"*, que es pedirle al usuario que haga a mano lo que el código puede hacer solo — y que es justo lo que `addTask` ya hace.

**Regla:** R-14, literal: *"si el guardado falla la fila optimista se retira: dejarla puesta es lo que produce el 'se guardó y luego desapareció solo'"*. Y **R-39** otra vez: la regla se aplicó al sitio que dolía y las otras 29 quedaron fuera sin anotarse. Es el mismo patrón que las 23 rutas mudas, un nivel más abajo.

**Propuesta:** que `onWriteError` acepte un tercer argumento opcional, la función de revertir, y que el `create` de cada store la pase. **Los `create` primero** — una fila fantasma que no existe es peor que un `update` que se quedó con el valor viejo. Los `remove` son el caso inverso y también importan: hoy si borrar falla, la fila desaparece de la pantalla y sigue en la base.

**Qué se rompería si se hace mal:** revertir un `update` exige guardar el valor anterior antes de pintar el nuevo; si se revierte a un objeto reconstruido en vez de al que había, se pierden los campos que la interfaz no toca — que es exactamente cómo los dos traductores borraron 13 campos el 11 de agosto.

---

### [3 · No hace lo que la founder dice] Dirección puede editar todo el cerebro del cliente; la base se lo rechaza después

**Dónde:** `src/hooks/useClientMode.ts:17` y `src/components/brain/BrainNav.tsx:39`. Ambos:

```ts
const isMember = role === 'member';
```

`UserRole` tiene tres valores desde el 19 de agosto (`useAuthStore.ts:10`: `'owner' | 'direccion' | 'member'`), pero estos dos sitios siguen preguntando por dos. Dirección no es `member`, así que `isMember` es `false` y `ClientBrainPage.tsx:166-184` le pasa **`readOnly={false}` a los 10 módulos**, y `canEditTasks` (`useClientMode.ts:27`, `!isMember || ...`) le da `true`.

**Qué pasa:** Lorenzo entra a un cliente, ve el ROPRE, corrige un riesgo mal redactado. La tarjeta cambia en pantalla. Salta *"No se pudieron guardar los cambios del ROPRE"*. La tarjeta corregida **se queda ahí** (hallazgo anterior) hasta que recargue. Lo mismo con tareas, métricas, proyecciones, programas, agenda, equipo y el perfil del cliente — incluida la casilla **"Este es el Espacio de Agencia"** (`ProfileModule.tsx:55`), que además canta éxito por su cuenta.

**La base aguanta**, y eso es lo bueno: la migración 040 le da a dirección **solo `for select`** en las 5 tablas (`040_rol_direccion.sql:96` — *"Todas son `for select`: dirección lee, no escribe"*). R-07 se cumple. Lo que falla es la interfaz, que ofrece lo que la base va a rechazar.

El código nuevo del 19-20 de agosto **sí lo hizo bien**: `TeamMembersPanel.tsx:104` usa `administra(rolUsuario)` para "Invitar" y "Copiar equipo", y `AppRouter.tsx:110` hace que `/configuracion` no exista para ellos. Los helpers correctos existen (`administra`, `veGlobal`); son estos dos sitios viejos los que no se actualizaron.

**Regla:** R-12 (dirección lee, no administra) y R-31 (un botón que solo puede fallar no se muestra).

**Propuesta:** que `useClientMode` deje de razonar sobre `member` y pase a razonar sobre qué puede hacer cada quién: `puedeEditar = administra(role)`, y `isMember` se queda solo para lo que de verdad es del miembro (sus departamentos, su acceso por cliente). Dos líneas y un renombrado.

**Qué se rompería si se hace mal:** en `BrainNav.tsx:39` `isMember` decide qué pestañas se ven según departamentos. Si ahí se sustituye por `!administra(role)`, dirección pasa a ver el nav recortado de un miembro **sin tener departamentos asignados**, y se queda con el set por defecto en vez de con las 9 pestañas. Son dos preguntas distintas —*quién eres* y *qué puedes hacer*— y hay que separarlas, no intercambiarlas.

---

### [3 · No hace lo que la founder dice] Dirección ve dos módulos vacíos, y el vacío no dice por qué

**Dónde:** `supabase/migrations/040_rol_direccion.sql:96-127` da lectura a dirección en **5 tablas**: `clients`, `tasks`, `meetings`, `team_members`, `ropre_items`. El nav (`BrainNav.tsx:22-34`) le muestra **9 pestañas**.

**Medido** — las policies de las tablas que faltan siguen siendo solo de la dueña:
- `programs` → `programs_via_client` (`018_client_access.sql:114`): `a.owner_id = auth.uid()`.
- `projections` → `projections_via_client` (`005_remaining_tables.sql:132`): `a.owner_id = auth.uid()`.

**Qué pasa:** Lorenzo abre **Programas** de un cliente y ve la lista vacía. Abre **Proyección** y ve ceros. No es que no haya programas: es que él no los puede leer. Nada en la pantalla lo distingue de "este cliente no tiene nada cargado" — y la conclusión natural es que el equipo no ha hecho el trabajo, que es exactamente la lectura equivocada para quien mira desde dirección.

**Regla:** R-36 (un vacío nunca es ambiguo) y **R-39**: R-12 dice *"lee todo lo del equipo de su agencia"* y se aplicó a 5 tablas de 7. Lo que quedó fuera no se anotó, así que la regla da por cubierto lo que no lo está — el mismo mecanismo que las 23 rutas mudas y que el hallazgo anterior. **Van tres.**

**Propuesta:** decidir explícitamente si Programas y Proyección entran en "lo del equipo". Si entran, dos policies `for select` con `direccion_ve_cliente(...)` — la función ya existe y ya es `security definer` (R-09). Si no entran, las pestañas no se le muestran, con el motivo. Lo que no vale es dejarlas vacías.

**Qué se rompería si se hace mal:** `projections` guarda números de dinero del cliente. Antes de abrirla a dirección hay que confirmar que eso es lo que la founder quiere — no es lo mismo ver el trabajo del equipo que ver la facturación.

---

### [4 · Features a medias] "Copiar equipo" anuncia el éxito antes de que se haya guardado nada

**Dónde:** `src/components/brain/modules/CopiarEquipoModal.tsx:90-96`.

```ts
for (const m of aCopiar) { ...; add(nueva); }   // línea 90 — no espera
toast.success(`${aCopiar.length} personas copiadas a ${destino.name}.`);  // línea 93
```

`add` (`useTeamMembersStore.ts:42-45`) pinta en memoria y lanza el `create` con `void`. La función es `async` y el `try/finally` no espera a ninguna promesa.

**Qué pasa:** la founder copia las 13 personas de David Guerrero a Ikigai Agencia. Lee **"13 personas copiadas a Ikigai Agencia"**, cierra el modal, y ve a las 13 en la lista. Si la base rechaza, aparecen detrás **13 avisos de error** contradiciendo al primero, y las 13 fichas se quedan en pantalla. Cierra tranquila, y al día siguiente el reporte de la Daily no le llega a nadie — que es el problema que esta función venía a resolver.

**Regla:** R-43 (un aviso no promete lo que no hizo), R-14, R-45.

**Propuesta:** que `add` devuelva la promesa —igual que `addTask` en `useClientStore.ts:96`, que ya devuelve `Promise<boolean>`— y que el modal haga `await Promise.all(...)`, cuente cuántas entraron de verdad y lo diga con nombre y motivo si alguna falló (R-33). El botón ya tiene su estado "Copiando…"; hoy dura un parpadeo porque no espera a nada.

**Lo demás de esta función está bien y conviene no tocarlo:** no copia el acceso ni los KPIs, marca "Ya está" a quien ya existe (R-44, idempotente de verdad) y avisa de quién no tiene correo.

---

### [4 · Features a medias] El interruptor "Espacio de Agencia" promete un menú que no existe, y puede dejar a un cliente sin puerta

**Dónde:** `src/components/brain/modules/ProfileModule.tsx:52-68` y `src/pages/ClientsPage.tsx:47`.

**Dos cosas, medidas:**

1. El texto de la casilla dice: *"deja de aparecer en la lista de clientes y pasa a la sección **Agencia** del menú"*. **Esa sección no existe.** `grep -n "Agencia" src/components/layout/Sidebar.tsx` devuelve **una sola línea, y es un comentario** (`Sidebar.tsx:27`: *"Acceso directo al Espacio de Agencia → se entra por Clientes"*). El código hace lo correcto desde el 20 de agosto; el texto describe un diseño anterior.

2. `ClientsPage.tsx:47` es `clients.find((c) => c.isAgency)` — **el primero**. El filtro de la rejilla (línea 52) esconde **todos** los que tengan la marca. Si alguien marca un segundo cliente por error, ese cliente **desaparece de Clientes, del Dashboard (`DashboardMacro.tsx:15`) y del menú (`Sidebar.tsx:57`)**, y el único botón que existe lleva al otro. Para recuperarlo hay que entrar a su perfil a desmarcar la casilla — y ya no hay forma de entrar haciendo clic.

**Qué pasa:** la founder está en el perfil de Marcelo Duarte, marca la casilla para ver qué hace. Lee "Marcado como Espacio de Agencia" y que pasará a una sección del menú. Vuelve a Clientes: Marcelo no está, y tampoco hay sección nueva. El botón de arriba sigue diciendo "Espacio de Ikigai Agencia". **Marcelo es inalcanzable salvo escribiendo la URL con su id** — que es el fallo que se acaba de arreglar el 20 de agosto, reintroducido por otra puerta.

**Regla:** R-47 (todo lo que existe tiene una puerta) y R-31 (si algo no se puede hacer, se dice dónde el usuario lo busca).

**Propuesta:** corregir el texto a lo que hace de verdad ("se entra desde la cabecera de Clientes"), y que la casilla no permita marcar un segundo si ya hay uno — con el motivo, diciendo cuál es el actual. El espacio de agencia es uno por agencia; que sea un booleano por cliente es lo que abre la puerta a tener dos.

**Qué se rompería si se hace mal:** si se bloquea sin decir cuál es el actual, quien quiera cambiar de espacio de agencia se queda sin salida. Hay que ofrecer desmarcar el que hay.

---

### [5 · Deuda técnica] La cabecera de Clientes cuenta un cerebro que la rejilla no muestra

**Dónde:** `src/pages/ClientsPage.tsx:77` dice `{clients.length} cerebros`; la rejilla (línea 52) descarta los `isAgency`.

**Qué pasa:** con Ikigai Agencia + 3 clientes, la cabecera dice **"4 cerebros"** y debajo hay **3 tarjetas**. Es pequeño, pero es la firma exacta de R-34 — el KPI que decía 0 clientes activos mientras la barra lateral decía 1 — y hace dudar de si falta un cliente por cargar.

**Regla:** R-34 (❓, pendiente de que la founder la confirme).

**Propuesta:** contar lo mismo que se pinta. Una línea.

---

### [Regla nueva propuesta] R-48 — Un store que no habla con la base no puede decir "guardado"

Los dos módulos del primer hallazgo no incumplen ninguna regla vigente. R-13 habla de escrituras **que fallan**; R-45, de resultados que tienen que sobrevivir. Ninguna cubre el caso de que **no haya escritura en absoluto** y la interfaz cante éxito igual — y por eso llevan meses ahí, invisibles para el CI, para el linter y para la auditoría anterior.

**R-48 propuesta:** *todo estado que el usuario cree haber guardado tiene una tabla, un repositorio y un lugar en el bootstrap. Un store que solo vive en memoria es legítimo (filtros, un modal abierto, una selección) pero no puede decir "guardado", "creado" ni "eliminado": lo que se anuncia como permanente tiene que serlo. Un store nuevo declara en su cabecera si persiste o no, y por qué.*

Se comprueba fácil y sin ejecutar nada: por cada store, `grep` de `Repo`/`persist` y del texto de sus toasts. Ese cruce es lo que encontró estos dos.

---

## Seguimiento

**Cerrado desde el informe del 18 de agosto:**

- ✅ **Hallazgo 1 (las 23 rutas mudas) — cerrado y verificado hoy.** `onWriteError` vive en su propio archivo (`src/store/onWriteError.ts`) y lo importan los 8 stores. `grep -c "console" ` sobre los `catch` de `src/store/*.ts` → **0**. No queda ninguna escritura muda. *(Sigue abierta la mitad de abajo: retirar la fila optimista — hallazgo 2 de hoy.)*
- ✅ **Hallazgo 2 (el rol de dirección no existía) — construido.** Migración 040, `UserRole` con tres valores, `/configuracion` inexistente para ellos. *(A medias en la interfaz — hallazgos 3 y 4 de hoy. R-12 sigue ⚠️ hasta que Lorenzo o Juan Camilo entren en producción.)*
- ✅ **R-39 adoptada** como regla del sistema (era el hallazgo 3 propuesto).
- ✅ **R-47 nueva y ya aplicada** — el espacio de la agencia tiene puerta desde el 20 de agosto. *(Con la grieta del hallazgo 6.)*
- ✅ **R-40, R-42, R-43, R-44** — las tres capas del duplicado al invitar, cerradas.

**Abierto, segundo informe seguido:**

- ❌ **R-29** — Paralelo se lee con el JWT de la sesión personal de la founder. Sin cambios: sigue esperando su llave de servicio. *(Si al tercer informe sigue igual, deja de ser un hallazgo y pasa a ser una decisión: o se acepta el riesgo por escrito, o se les pone fecha.)*
- ❌ **R-32** — los 5 interruptores de mentira de Configuración. Verificado hoy: `useIntegrationsStore.ts:22` sigue siendo un `persist` a `localStorage` y nada más. Sin cambios.
- ⚠️ **R-11** — las reglas de permisos siguen sin probarse con una cuenta real de cada rol. **Es lo que habría cazado los hallazgos 3 y 4 antes de que yo los leyera**: media hora entrando como Lorenzo y se ven los dos.
- **Una persona, un solo rol** (`src/types/teamMember.ts:41`, `rol: TeamRoleSlug`). Sin cambios; Jhonatan Rengifo sigue con el parche.

---

## Salud del sistema

**Comprobadas hoy y cumpliéndose:**
- **R-13** — ninguna escritura muda. 30 rutas, 8 stores, 0 `console.warn` sueltos.
- **R-07** — la privacidad y los permisos viven en la base. La migración 040 le da a dirección solo `select`, y por eso los hallazgos 3 y 4 son molestias de interfaz y no agujeros.
- **R-09** — `es_direccion()` y `direccion_ve_cliente()` son `security definer`.
- **R-08** — la 040 no toca ni desactiva ninguna policy anterior, y lo dice explícitamente.
- **R-44** — "Copiar equipo" es idempotente de verdad: quien ya está sale marcado y con la casilla bloqueada.
- **R-16** — un solo traductor por tabla. Sin regresión.
- **R-36** — el bootstrap conserva el diagnóstico que cuenta los espacios de agencia (`bootstrap.ts:166`).

**Empeoró:** ninguna.

**A medias, y es el patrón del día:** tres hallazgos de hoy (2, 3 y 4) son la misma forma — una regla aplicada al sitio que dolía, con el resto sin anotar. R-39 existe justo para esto y se escribió hace tres días; hoy es la primera vez que se usa para medir.

**Sin comprobar:** R-18 (que el repo refleje la base) exige comparar contra producción. R-20, R-21 y R-37 necesitan ejecutar, no leer.
