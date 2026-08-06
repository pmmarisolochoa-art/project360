# Historial de Decisiones — Project360

> Log **inmutable** de decisiones de este workspace: dirección, presupuestos, lanzamientos, cambios de rumbo. Más recientes arriba. Las decisiones se agregan, nunca se sobreescriben. Si una decisión cruza ecosistemas → también va a `~/Desktop/CLAUDE/Cerebro_Central/Historial_Decisiones_Centrales.md`.

---

## 2026-08-05 (tarde) — El repo por fin tiene red de seguridad automática: CI verde a la primera

Commits `112ff89`, `eac5084` y `09584f2`, **los tres en `origin/main`**. Hasta hoy el repo **no tenía ninguna verificación automática**: que el código compilara dependía de que alguien se acordara de correr `tsc` y `build` a mano.

**1. Decisión de criterio del linter: bloquear solo lo que es un bug real.** `eslint.config.js` deja en `error` únicamente `react-hooks/rules-of-hooks` (un hook dentro de un `if` rompe React de forma impredecible); todo lo demás —`no-explicit-any`, `no-unused-vars`, las reglas del react-compiler— entra como **aviso**. Razón: son ~62 warnings sobre código que nunca se lint-eó, y **un linter que grita por todo se termina ignorando**, que es peor que no tenerlo. La regla para adelante: a medida que se limpie una categoría, se sube de `warn` a `error` para que no vuelva a colarse. Se ignoran `api/` y `supabase/` porque corren en Node/Postgres, no en el navegador.

**2. GitHub Actions en cada push a `main` y cada PR:** typecheck → lint → build, con `cancel-in-progress` para no gastar minutos en commits ya superados. **Primera corrida: verde en 1m21s** (run `31038363285`).

**3. Se resolvió el misterio de las ramas fantasma `ci/safety-net`.** Desde el 27-jul aparecían ramas nuevas y el branch cambiaba entre commits; la entrada de esa fecha lo anotó como "proceso externo, revisar". **No era un proceso externo: era este mismo trabajo fallando al subir.** El token de git no tenía el scope `workflow` y GitHub rechaza cualquier push que cree o modifique un archivo en `.github/workflows/`. El commit del CI quedaba varado en local y se abría rama nueva. Trampa a recordar: **el mensaje del commit `eac5084` daba por resuelto el scope, pero el push había fallado** — un commit hecho no es un commit subido.

**4. Hallazgo del entorno: hay un `GITHUB_TOKEN` inválido exportado en el shell** y tiene prioridad sobre la sesión buena del llavero, así que `gh` respondía `401 Bad credentials` aunque la autenticación estuviera bien. Se trabajó con `env -u GITHUB_TOKEN` delante de cada comando. El arreglo definitivo (borrarlo del `~/.zshrc`) queda pendiente.

**5. Limpieza de los 7 warnings auto-fixeables** (69 → 62): dos `let` que nunca se reasignan → `const`, y cinco `eslint-disable` inertes (apuntaban a reglas que nuestra config no activa). **Decisión de detalle:** los dos `eslint-disable react-hooks/exhaustive-deps` de `MiEspacio.tsx` **no se borraron a secas** — se reemplazaron por un comentario normal, porque la razón de por qué esas dependencias se omiten a propósito es información que vale la pena conservar aunque el linter ya no la pida. Los 62 warnings restantes son casi todos `no-explicit-any`: deuda real, no auto-fixeable, sin urgencia.

**Por qué:** es la prioridad ② del workspace (estabilizar lo construido). Con la app ya operando clientes reales, un error de compilación que llegue a producción cuesta más que los 90 segundos de CI.

**Próximos pasos:**
- **Pendiente de la founder:** borrar el `GITHUB_TOKEN` inválido del `~/.zshrc` (o `~/.zprofile`).
- Subir `actions/checkout` y `actions/setup-node` a `@v5` — GitHub ya avisa que Node 20 está deprecado en los runners. Funciona hoy; hacerlo la próxima vez que se toque el workflow.
- Ir bajando los `any` por módulo y subiendo la regla a `error` cuando una zona quede limpia.

---

## 2026-08-05 — Reestructuración a "Ikigai Agencia": 7 commits, 4 migraciones, y la tarea como fuente de verdad

Sesión larga de cambios estructurales. **7 commits en la rama `feat/ikigai-agencia-estructura`, sin pushear.** Las 4 migraciones (028–031) **sí están corridas en prod** y verificadas. Verificado `tsc -b` limpio y `npm run build`; la founder validó a mano las 7 rutas.

**1. Decisión de identidad: "Sales Brain OS" es el producto, "Ikigai Agencia" es esta instancia.** El nombre visible se centraliza en `src/config/brand.ts` (`name` / `subtitle` / `label`) en vez de repartirse por la app. Razón: el día que se venda el producto a otra agencia, renombrar debe ser una línea y no una cacería por 12 archivos — es el primer ladrillo del white-label. Se aplicó también a **los 5 generadores de PDF**, que los ve el cliente final. Repo, variables de entorno e identificadores internos siguen siendo `project360` a propósito.

**2. Decisión de datos: la fila "Ikigai" era en realidad David Guerrero.** El spec pedía `UPDATE clients SET nombre='David Guerrero' WHERE nombre ILIKE '%ikigai%'`. Se frenó antes de ejecutarlo porque esa fila tenía `is_agency = true` y colgaban de ella **las 163 tareas existentes** — renombrarla habría borrado el contenedor de agencia. Al revisar los títulos (VSL, oferta USD 2000, downsell, call center, anuncios) quedó claro que **era trabajo de cliente real, no operación interna**; la founder lo confirmó. Solución que no pierde nada: renombrar esa fila a David Guerrero y bajarle la bandera (conserva sus 163 tareas), crear un Espacio de Agencia **nuevo y vacío**, y crear Andrea Torres. **Dos trampas evitadas:** las columnas son `name`/`business_type`, no `nombre`/`tipo`; y `project_type` tiene un CHECK que acepta `personal_brand`, **no** `marca_personal` — el valor del spec habría sido rechazado en silencio desde el cliente REST (misma trampa ya documentada). Se apuntó por `id` exacto, no por `ILIKE`, para no arrastrar otra fila.

**3. Decisión de arquitectura: un solo módulo de tareas, no dos.** La vista global `/tareas` era una tabla aparte con 3 filtros y se quedaba atrás cada vez que el módulo del cerebro del cliente mejoraba. **Se eliminó la tabla:** `/tareas` monta el MISMO `TasksModule` en modo global (`client={null}`). Así hereda automáticamente tabs rápidos, los 4 filtros, Kanban/Lista/Gantt, drag & drop, KPI de resultado, recordatorios y dedupe. **Razón de fondo:** con dos componentes esa deriva era inevitable; con uno, no puede volver a pasar. El acoplamiento al cliente eran solo 8 puntos y TypeScript los señaló todos. Tres detalles resueltos: los recordatorios se agrupan por cliente (el endpoint resuelve correos contra el equipo de UNO); "Nueva tarea" se deshabilita con el filtro en "Todos los clientes" (si no, crearía tareas sin dueño); y `resolveAssignee` pasa a usar `t.clientId` en vez del cliente del módulo.

**4. Decisión de seguridad: el filtro de privacidad vive en RLS, no en el frontend.** Filtrarlo solo en React dejaría los datos accesibles para cualquiera que llame a la API con su token. Se reescribieron las policies de `tasks` y `meetings` con un helper `puede_ver_fila()`. **Se reescribió también la policy de la dueña de agencia: tú tampoco ves lo privado de otra persona** — un espacio privado que el jefe puede leer no es un espacio privado. CHECK de que toda fila privada tenga dueño (si no, sería invisible para todos). Todo entra con `default false`: **ninguna fila existente cambia de visibilidad**. Regla 5D aparte: lo privado se corta en la ENTRADA de cada reporte, incluso en el de su propio dueño, porque un reporte se comparte.

**5. Decisión de modelo: los links NO se copian entre tablas.** El spec pedía "propagar" un link de la tarea a la base del cliente y al repositorio. Se implementó como el propio spec decía en su letra chica —*"no es una copia, es la misma fila vista desde dos lugares"*— porque copiar filas es exactamente lo que desincroniza las vistas. Todo sale de `task_links`, con `meeting_id` heredado de la tarea (permite "dame los entregables de la reunión del 15 de junio"). **Hallazgo de paso:** el repositorio de Links y Entregables vivía **solo en memoria** (`useRepositoryStore`) — lo que se agregaba ahí desaparecía al recargar. Ahora persiste. También se guarda `created_by_nombre` copiado al insertar, porque `created_by` es un auth user id y la app no tiene cargado el mapeo id→nombre.

**6. Rutas en español, con redirecciones permanentes.** `/clients`→`/clientes`, `/agenda`→`/agenda-global`, `/team`→`/equipo`, `/settings`→`/configuracion`, `/tasks`→`/tareas`, `/repositorio/*`→`/links-entregables`, `/agente-sop`→`/configuracion`. **Se conservan a propósito:** hay correos ya enviados y enlaces guardados con las rutas viejas. Se borran cuando ya nadie las use. El sidebar queda con exactamente 7 ítems; Agente SOP se movió dentro de Configuración.

**7. Bug preexistente que salió a la luz: cliente nuevo tumbaba el Dashboard.** Al crear Andrea Torres, `/dashboard` reventó. Causa: una fila nueva llega con `metrics = {}` (default de la columna) y el mapeo hacía `metrics: r.metrics ?? {defaults}` — **`{}` no es nullish**, así que `roas` quedaba en `undefined`. Y la tarjeta decía `roas !== null ? roas.toFixed(1) : '—'`: como `undefined !== null` es **true**, llamaba `.toFixed()` sobre `undefined`. **Arreglo en la raíz:** los defaults ahora se **mezclan** en vez de reemplazarse, así que todo cliente sale siempre con la forma completa. Además las comparaciones pasan a `!= null` (cubre ambos) en tarjeta, encabezado del cerebro y PDF. **No era del cambio de hoy:** cualquier cliente creado desde el onboarding habría roto el Dashboard igual; no se había visto porque solo existía un cliente, creado antes con métricas completas.

**8. Decisión operativa: las migraciones las corre la founder, no el asistente.** No hay `psql` ni CLI de Supabase en el entorno, y la única llave disponible es la anon. Aunque hubiera la de servicio no serviría: las escrituras pasan por PostgREST, que **no ejecuta DDL**. Se generó `MIGRACIONES_028_031.sql` (las 4 concatenadas en orden) para pegar de una en el SQL Editor. **Orden correcto confirmado: base primero, código después** — el código nuevo manda columnas (`es_privada`, `origen`, `meeting_id`) que sin migración provocan 400 en silencio, el mismo modo de fallo del 30-jul. Pendiente decidir si se instala el CLI para automatizar esto a futuro.

**9. El trabajo quedó en rama, no en `main`.** `main` no se mueve sola para que la founder decida el momento del deploy. Merge cuando quiera: `git checkout main && git merge feat/ikigai-agencia-estructura && git push origin main`. **Ojo al estado actual: producción corre el código VIEJO contra la base NUEVA.** Funciona porque todo fue aditivo, pero las funciones nuevas solo existen en local hasta ese merge.

**Nota sobre la granularidad de los commits:** tres archivos tocan más de una sección (`repositories.ts`, `Sidebar.tsx`, `reportsPdf.ts`). Separarlos habría requerido partir archivos por líneas y producir commits que no compilan. Se priorizó que **cada commit sea coherente y buildeable**, explicándolo en su mensaje.

**Pendientes:** hacer el merge y desplegar; borrar `LinksRepoPage.tsx` y `DeliverablesRepoPage.tsx`, que quedaron sin usar; borrar `MIGRACIONES_028_031.sql` (copia de las migraciones, no se versionó); afinar los defaults de estado en el Kanban global cuando haya datos de Andrea. **Sigue abierta la integración con Paralelo** (ver entrada aparte): endpoints `GET`/`POST` de tareas para que Ikigai GM consuma Project360, con emparejamiento vía `external_id`.

---

## 2026-08-03 (tarde) — El seed nunca se escribe en Supabase (39 errores 400 en /team → 0)

Commit `34d2170`, **pusheado a prod**. Cierra el hallazgo lateral de la entrada anterior.

**Causa raíz:** `TeamPage` llama a `ensureForClient()` para **todos** los clientes del store, y antes de hidratar el store son los del **seed in-memory** (`src/data/seed.ts`), cuyos ids son legibles (`c_fitmind`, `c_kuroko`, `c_escueladigital`) y no uuid. Cada asignación generada intentaba persistirse contra columnas uuid de Supabase y moría con `22P02`. 39 peticiones fallidas cada vez que alguien abría Equipo.

**Decisión: el guard vive en `utils/`, no en el store.** Nuevo `src/utils/persistableId.ts` con `isPersistableId()` (test de forma uuid). Se puso ahí en vez de dentro de `useTeamStore` porque **cualquier store que persista por `clientId` puede caer en lo mismo** — hay 7 stores con escrituras a repos. Aplicado en los **dos** caminos de escritura de `useTeamStore`: el upsert inicial de `ensureForClient()` y el debounced de `update()`. **El estado en memoria se sigue creando igual**, así que la UI en modo local (sin Supabase) no cambia en nada.

**Verificación:** `/team` pasa de 39 errores a **0**, renderizando idéntico — 2 gráficas y 2476 chars de texto, exactamente los mismos números que antes del cambio (cero regresión). El guard se probó contra el uuid real de Ikigai (persiste), los 3 ids del seed y `null`/`undefined`/vacío (no persisten). De paso se confirmó en la pestaña de red que los `PATCH /tasks` ahora devuelven **204** — evidencia adicional de que la migración 027 dejó sano el guardado de tareas.

---

## 2026-08-03 — Code-splitting: carga inicial 3.9 MB → 1.33 MB (402 KB gzip)

Commit `439b19a`, **pusheado a prod**. El bundle entero viajaba en un solo `index.js` de 3.9 MB aunque abrieras solo el dashboard — varios segundos en 4G antes de ver nada, que es lo que sufre el equipo en Colombia.

**1. Corrección al plan que se había escrito el 01-ago.** El plan decía "`manualChunks` primero por ser el de mayor impacto". **Era incorrecto y se verificó midiendo:** `manualChunks` solo mejora el caché entre deploys; si todo se importa estáticamente el navegador lo descarga igual, así que **no reduce la primera carga**. Lo que sí la reduce es `import()` dinámico y `React.lazy`. Se hizo en ese orden y se midió cada paso.

**2. Librerías pesadas a `import()` dinámico** (3.9 → 3.0 MB). jsPDF, html2canvas, xlsx, mammoth y marked solo hacen falta al pulsar "exportar" o subir un archivo, nunca al cargar una página. Convertidas en `ReportsMenu`, `ProjectionsModule`, `FunnelLaunchPanel`, `SopAgentPage`, `MeetingDrawer` y `FunnelImportModal`. **Todos los call sites ya estaban en try/catch con toast** (gracias al trabajo del 01-ago), así que un fallo al bajar el chunk queda cubierto; solo en `SopAgentPage` faltaba el catch y se añadió. **El typecheck atrapó un segundo uso de `exportSopReport`** que el grep inicial no vio — sin él habría quedado un botón roto.

**3. Rutas con `React.lazy` + `Suspense`** (3.0 → 1.33 MB). `DashboardMacro` y `LoginPage` siguen eager por ser los puntos de entrada reales (hacerlas lazy solo añadiría parpadeo). El resto baja al navegar — esto saca `recharts` y el `ClientBrainPage` (1 MB él solo) del arranque. Los `.then` mapean el export nombrado al `default` que `lazy` espera.

**4. `manualChunks`** para lo que sí sirve: react/supabase/recharts/framer-motion en chunks propios, para que un deploy nuevo no obligue a re-descargarlos.

**Verificación (medida, no estimada):** con Playwright sobre el **build de producción**, `performance.getEntriesByType('resource')` → 4 archivos, 1.33 MB sin comprimir, **402 KB transferidos** (antes 3.9 MB / ~1.08 MB). Y logueado: las 9 rutas montan sin pantallas en blanco —incluida `/team`, que carga recharts desde su chunk con las 2 gráficas renderizando—, `ClientBrainPage` abre por clic, y el `import()` dinámico se probó **end-to-end generando un Reporte Mensual real** (PDF de 3 páginas). 34 chunks en total.

**Hallazgo lateral (NO es del cambio, ya existía):** `/team` lanza **39 errores 400** contra `client_team_members` — `22P02: invalid input syntax for type uuid: "c_escueladigital"`. Son **IDs del seed in-memory** (`src/data/seed.ts`: `c_fitmind`, `c_kuroko`, `c_escueladigital`) que `useTeamStore` intenta hacer upsert contra columnas uuid de Supabase. Ruidoso e inútil, pero no rompe la UI. **Pendiente de limpiar.**

**Pendientes:** limpiar los upserts del seed que ensucian `/team` con 39 errores; probar el ciclo **logout→login** (sigue sin verificarse; ojo: la sesión de Supabase caducó a mitad de esta sesión con `Invalid Refresh Token`, comportamiento normal de expiración).

---

## 2026-08-01 — Ninguna escritura fallida vuelve a perderse en silencio + migración 027

Continuación directa de la sesión del 30-jul. Commit `969dcba`, **pusheado a `origin/main`** (`f591aab..969dcba`). *Nota: la entrada del 30-jul dice "sin pushear" — ya no aplica, los tres commits (`d7cd0d0`, `f591aab`, `969dcba`) están en prod.*

**1. Decisión de arquitectura: las escrituras optimistas SIEMPRE avisan al fallar.** Al investigar el bug de `updatedAt` apareció el problema de fondo: **7 de las 9 rutas de escritura a Supabase solo hacían `console.warn` al fallar** (clientes, tareas y reuniones × crear/editar/borrar). Como la UI es optimista —pinta el cambio antes de que la BD confirme— un fallo dejaba al usuario creyendo que guardó, y el trabajo se perdía al recargar sin ningún aviso. Eso es exactamente lo que ocultó durante días que `tasks.update` devolvía 400. Las de reuniones ya avisaban bien (alguien lo resolvió en una sesión previa); se **extrajo ese patrón a un helper `onWriteError(label, mensaje)`** en `useClientStore` y se aplicó a las 9. Cero `console.warn` mudos. **Regla para adelante:** si una escritura es optimista, su `.catch` muestra toast — no basta con loguear.

**2. Migración `027_tasks_updated_at.sql` — ✅ CORRIDA en prod el 01-ago** (verificada vía REST: `select=id,updated_at` → 200 con valor, contra un control con columna inexistente → 400 `42703`). Agrega `updated_at` a `tasks` + trigger `tasks_touch`, reusando la función `touch_updated_at()` que ya existe y que ya usan `clients` y `projections` (no se inventó patrón nuevo). Aditiva e idempotente. **Decisión sobre su prioridad:** se verificó que **hoy nada en la app lee `task.updatedAt`** (cero consumidores), y el código que la escribía ya se revirtió — así que no hay nada roto esperando. La migración es para **desactivar la mina**: `taskToRow()` sigue mapeando `updatedAt → updated_at`, así que el día que alguien vuelva a meter ese campo en un patch, revienta igual. Con la columna puesta ese camino queda cerrado y de paso se gana auditoría de "última modificación" para el equipo.

**3. Playwright MCP usado para probar un camino de error, no solo el happy path.** Se interceptó `window.fetch` para forzar un `400` en `PATCH /tasks`, se marcó una tarea como completada y se verificó que el toast sale en un `role="status"`. El mock además **impidió que la prueba escribiera en la base de producción** — se confirmó al recargar que la tarea seguía pendiente. Patrón reutilizable para probar fallos sin tocar datos reales.

**Pendientes:** probar el ciclo **logout→login** tras el cambio de bootstrap del 30-jul (requiere credenciales, solo lo puede hacer la founder — si aparecieran datos viejos, la causa es la caché de bootstrap); **code-splitting** del bundle (`dist/index.js` = 4 MB / 1 MB gzip en un solo archivo → varios segundos de espera en 4G para el equipo en Colombia). Plan acordado para el code-splitting, en dos pasos de menor a mayor riesgo: (a) `manualChunks` en `vite.config.ts` separando React/Supabase/framer-motion/PDF — riesgo bajo, mejora inmediata por caché de vendor; (b) `React.lazy` por ruta — el golpe grande, toca el router y puede romper navegación de forma sutil. **Se dejó para una sesión propia** por ser lo primero de estas sesiones que puede romper prod de verdad; ahora hay Playwright para verificar cada ruta después de partir el bundle.

---

## 2026-07-29 — Integración con Paralelo (Ikigai GM): Project360 expone la API, ellos la consumen

Decisiones de diseño acordadas. **Nada construido todavía** — queda como el siguiente bloque técnico.

**1. Decisión de secuencia: la integración va ANTES de los cambios de navegación.** Razones: (a) la integración es la parte con incógnitas externas —depende de otra app— mientras que la navegación depende solo de nosotros y se puede hacer cualquier día; (b) **la conexión va a decir cuál debe ser la navegación**, así que decidirla antes arriesgaba rehacerla; (c) Andrea Torres tiene menos tareas, así que es el cliente de prueba correcto: si el sync duplica algo, el radio de explosión es chico.

**2. Dirección: solo Paralelo → Project360.** Project360 **expone** la API y Paralelo la consume (no al revés). Fase 1: Paralelo actualiza las tareas actuales. Después: alimentar con transcripciones de reunión y extracción de tareas. Ida y vuelta se descartó por ahora — habría que resolver conflictos de quién gana y el riesgo de escribir mal en la otra app.

**3. Hueco detectado y resuelto en el diseño: el emparejamiento.** Las tareas que ya existen en Project360 se crearon adentro, así que su `external_id` está vacío y Paralelo no tiene con qué referenciarlas. Emparejar por título es frágil. **Por eso son dos endpoints, no uno:** `GET /api/paralelo/tareas?cliente=AT` para que Paralelo lea y se quede con los IDs, y `POST /api/paralelo/tareas` para que actualice mandando de vuelta su `external_id` — que queda guardado y a partir de ahí el emparejamiento es automático. Es justo para lo que se dejó el campo en la Fase 1 (commit `63c9c4b`).

**4. Mapeo, leído de la app real (captura de Ikigai GM).** Estados: Pendiente→`pending`, En Progreso→`in_progress`, Completado→`completed`, Bloqueado→`blocked`. **Dos huecos decididos:** Project360 tiene `in_review` y Paralelo no → el sync **no toca** una tarea que esté en revisión, porque la revisión es nuestro proceso, no el de ellos; Paralelo tiene "Cancelado" y nosotros no → mapear a `blocked` con comentario, sin inventar un estado nuevo. **El cliente se identifica por el campo `Project`** de Paralelo, no por sigla en el título. **Ojo: puede haber proyectos en Paralelo que no existan como cliente en Project360** — hay que crearlos o dejarlos fuera del sync a propósito. *(Editado el 06-ago a petición de la founder para quitar el nombre de un proyecto descartado; la decisión no cambia. Es la única excepción hecha a la regla de que este log no se reescribe.)*

**5. Defaults de seguridad acordados** (es una puerta de escritura desde afuera): `x-api-key` con secreto en Vercel, sin OAuth; **lista blanca de campos escribibles** (estado, fecha, responsable, output, comentarios) — no puede borrar tareas ni cambiar de cliente, así el daño de un bug de ellos queda acotado; escritura server-side con service role, nunca desde el navegador; **respuesta por tarea** (`ok`/`error`) para que un dato malo no tumbe el lote entero, como ya pasó con el correo del reporte; y log de cada llamada.

**Observación de arquitectura:** Paralelo también trata "Ikigai" como un proyecto más al lado de los clientes — el mismo modelo plano que teníamos. Reforzó la decisión de arreglar la navegación y no la base de datos.

**Pendiente de confirmar:** si el "copiloto de Ikigai" (carpeta `~/Desktop/CLAUDE/ikigai-copilots`) puede editar el código de Ikigai GM. Si sí, no se depende de otro equipo: se construyen los endpoints y se le pasa el spec para que implemente el lado de Paralelo.

---

## 2026-07-30 — Playwright MCP como verificación en navegador + fix de "cliente activo" + bootstrap x4 → x1

Primera sesión usando **Playwright MCP** para verificar la app en un navegador real. Commit `d7cd0d0` (local en `main`, **sin pushear**).

**1. Decisión: "cliente en onboarding SÍ cuenta como activo".** El KPI "Clientes activos" del Dashboard Macro mostraba `0` teniendo a Ikigai activo, mientras el sidebar y las tarjetas mostraban `1` — tres lugares filtraban por su cuenta y dos estaban mal. Razón de la decisión: `planning` ya contaba como activo y `onboarding` es la fase *anterior*, así que excluirlo no tenía lógica; además un cliente en onboarding ya consume horas y presupuesto ($10.000 invertidos en Ikigai). **Fuente única de verdad nueva** en `src/types/client.ts`: `ACTIVE_CLIENT_STATUSES = ['onboarding','planning','active']` + helper `isActiveClient()`, consumido por `GlobalStats` y `Sidebar`. Si mañana se decide que `paused` también cuenta, se cambia en un solo lugar.

**2. Bootstrap de Supabase: 4 rondas de queries por carga → 1.** `bootstrapFromRemote` se disparaba varias veces mientras el contexto de auth se resolvía (×2 más por StrictMode en dev) = 4 hidrataciones completas por page load. Ahora es **idempotente por contexto de sesión** (cachea la promesa por `userId:agencyId`); `AuthGate` limpia la caché al cerrar sesión. **Decisión de diseño importante:** NO se gateó por `agencyId != null` — se verificó que los **miembros de equipo legítimamente tienen `agencyId: null`** (`services/auth.ts:106`), así que esa condición habría roto el acceso del equipo. ⚠️ **Sin probar:** el ciclo logout→login (no había credenciales en sesión). Si al reentrar aparecieran datos viejos, la causa está ahí.

**3. 🔴 Bug de pérdida de datos encontrado y revertido.** Había un cambio **sin commitear** en `src/store/useClientStore.ts` que sellaba `updatedAt` en cada `updateTask`, con el comentario "la BD también la fija por trigger". **Esa columna no existe** en la tabla `tasks` (`supabase/schema.sql` solo tiene `created_at`). Resultado: **toda** actualización de tarea devolvía `400 / PGRST204` y, como el repo solo hace `console.warn`, la UI mostraba el cambio como guardado y no se guardaba nada. Se **revirtió el archivo** (`git checkout`). Producción nunca estuvo afectada porque el cambio jamás se commiteó. **Aprendizaje de fondo:** que un fallo de escritura a Supabase sea solo un `console.warn` es lo que permitió que pasara inadvertido — los errores de persistencia deberían mostrar un toast.

**4. Script `typecheck` estaba roto** desde hacía tiempo: `tsc -b --noEmit` es inválido en proyectos composite (error `TS6310`). Ahora es `tsc -b`.

**Pendientes:** decidir si se agrega `updated_at` + trigger a `tasks` (o se deja sin sellar); hacer que los errores de escritura muestren toast en vez de solo `console.warn`; probar logout→login; **pushear `d7cd0d0`**; `dist/index.js` pesa 4 MB (1 MB gzip) sin code-splitting — cargas lentas en móvil LATAM; migrar a future flags de React Router v7.

---

## 2026-07-27 — Reportes de reunión por correo + tipos nuevos + anti-duplicados + fixes UX

Sesión larga de features y estabilización sobre el sistema de reuniones. Todo en producción (main → Vercel).

**1. Reporte ejecutivo de reunión (PM experto) en PDF + envío por correo.** Cada reunión genera un reporte con análisis IA (titular, deck, KPIs, decisiones, riesgos, próximos pasos, foco de la próxima reunión) — `meeting_report` en el backend. Se **envía por correo al equipo** con el PDF adjunto (endpoint `api/enviar-reporte-reunion.ts` vía Resend), y hay **selector de destinatarios** (elegir a quién). Auto-envío al "Marcar como realizada" + botón manual "Enviar al equipo". **Decisión de diseño:** el reporte reusa el motor paginado del reporte semanal (`composeReport`, exportado) en vez del approach editorial rasterizado que rompía la paginación — así queda coherente con el semanal, con cabecera/footer por página y tamaño A4 correcto. **3 bugs resueltos en el camino:** (a) PDF pesaba varios MB (PNG) → excedía el límite del Edge Function → ahora JPEG comprimido; (b) `meeting_report` daba 504 con notas largas → ahora FAST_MODEL (Haiku) + notas acotadas; (c) un correo mal escrito en el equipo tumbaba TODO el envío → ahora valida formato y omite los inválidos. Ojo: dominio ya verificado en Resend (los recordatorios llegan), RESEND_FROM OK.

**2. Tipos de reunión nuevos.** `general` (esporádica, sin tema fijo) y `management` (gerencia: SOPs, KPIs de agencia, decisiones estratégicas). **Decisión:** las reuniones internas de la agencia viven dentro del **cliente Ikigai** (ya existe en prod, no se creó cliente nuevo). Filtro "Cliente / Internas" + badge "🏛️ Interna" en el módulo (helper `isInternalMeeting`). También `weekly_closing` de la sesión anterior seguía activo.

**3. Anti-duplicados de tareas de reunión.** Se limpiaron duplicados existentes con un detector nuevo (banner + modal "Revisar y limpiar" en el módulo Tareas, conserva la más avanzada) + alerta al crear una tarea con título repetido. Y se cerró la fuente: guard compartido `dedupeExtracted()` (util nuevo) aplicado en los **3 puntos** de extracción (extraer manual, auto-extract al cerrar, confirmar) — antes solo el manual deduplicaba. Filtra contra tareas abiertas Y dentro del mismo lote.

**4. Fixes UX:** chat del Agente PM ahora en **streaming token por token** (resuelve el 504 del chat + efecto typing); filtro de **tareas por persona** (además de por rol, que ahora refleja el equipo real y matchea múltiples roles de una persona); buscador global — dropdown ya no se solapa con la página (z-index) y **clic en resultado abre la tarea/reunión** (deep-link `?task=`/`?meeting=`).

**⚠️ Alerta de infraestructura:** hay un **proceso externo concurrente** creando ramas `ci/safety-net*` desde main y cambiando el branch activo entre commits (aparecen commits "ci: red de seguridad" ajenos). No son hooks locales. Dos commits cayeron en esas ramas y hubo que moverlos a main a mano. Todo quedó bien en `origin/main`, pero **revisar qué automatización/terminal las crea** para que no interfiera.

**Pendientes:** validar E2E el correo del reporte con equipo real (probar el flujo completo); WhatsApp/GHL sigue en standby (sin línea); investigar el proceso que crea ramas ci/safety-net.

---

## 2026-07-23 — Sprint de cierre de semana + WhatsApp en STANDBY (sin línea en GHL)

**1. Nuevo tipo de reunión "Sprint de cierre de semana" (`weekly_closing`) — EN PRODUCCIÓN.** Reunión de PM para cerrar la semana con seguimiento riguroso. Al abrirla, el drawer muestra automático (sin tokens, data del store): cumplimiento global de la semana Lun-Dom (N/M + barra %), ✅ completadas, ⏳ no completadas (prioridad, bloqueadas, atraso `hace Nd`) y 👥 cumplimiento por responsable. La agenda IA genera estructura PM de 6 puntos con tiempos (resumen → causas de lo no completado → cumplimiento por persona → decisiones reprogramar/reasignar/cancelar → aprendizajes → compromisos próxima semana) + fallback sin IA. Componente nuevo `WeeklyClosingReview.tsx`; tipo agregado en toda la app (labels, agente PM, reportes). **Sin migración** (la 022 ya liberó el CHECK de tipos). Commit `dbec865`, push a prod.

**2. WhatsApp vía GHL → STANDBY.** Se re-probó el webhook nuevo (`Success` 200, workflow mapeado por el equipo), pero plataformas confirma que **no hay línea de WhatsApp activa en las cuentas de GHL**. Decisión: congelar el canal WhatsApp por ahora (los recordatorios siguen saliendo por email/Resend). Opciones evaluadas para retomar: (a) activar línea en GHL (~$10/mes subcuenta + costo Meta, depende del equipo), (b) WhatsApp Cloud API propia de Meta (independiente, 1000 conversaciones/mes gratis, requiere verificación + plantillas + `api/_whatsapp.ts` nuevo — el camino "serio"), (c) cambiar a Telegram (gratis, sin aprobaciones, listo en un día). Número de prueba para cuando se retome: +573017907593.

**Pendientes:** probar el Sprint de cierre con una semana real de Marcelo; decidir camino de WhatsApp; registrar resto del equipo; validar bloque B con Marcelo.

---

## 2026-07-22 — Bloque B cerrado (SLA) + alta de equipo self-service con correo

**Dos entregas a producción (validadas):**

1. **Tiempos de entrega / SLA por tipo de tarea** — cierra el bloque B (inteligencia de reuniones). Nuevo `src/config/taskSLA.ts`: tabla editable de días objetivo por `tag` de tarea (ads 2, content 2, strategy 3, meeting 1, deliverable 3, ropre 5, other 3) + helper `evaluateSLA`. En el "Recuento de la reunión anterior" (`MeetingRecap.tsx`) cada compromiso ahora muestra **atraso** (`hace Nd` vs. fecha pactada) y **badge de cumplimiento** (En SLA / Fuera de SLA), más resumen `N/M dentro de SLA`. Sin migración (usa `createdAt`/`dueDate`/`completedAt`/`tag`). Decisión: los defaults de SLA se dejan sin afinar por ahora ("vamos evaluando"); el cumplimiento vive solo en el recap, el config es reutilizable para enchufarlo a Equipo después. Commit `05dd551`.

2. **Alta de equipo self-service + correo automático** — el botón "Invitar miembro" + Edge Function `api/invitar-miembro.ts` ya existían (crean login Auth + `users` + `team_members`, validan owner, rollback). Lo nuevo: al invitar, el endpoint **envía un correo vía Resend** con el acceso (correo + contraseña temporal + botón a `/login`), best-effort (si falla, el miembro igual queda creado y el toast avisa que se comparta manual). Con esto se acaba el alta manual en Supabase. Migraciones que lo sostienen (todas corridas): 018 (user_id+access_level), 021 (departamentos), 023 (telefono). `SUPABASE_SERVICE_ROLE_KEY` confirmada en Vercel. Validado E2E: correo llegó. Commit `40656de`.

**GHL / WhatsApp — bloqueado en el equipo de plataformas.** Enviamos payload de prueba al Inbound Webhook (`Success` 200) pero el WhatsApp no llega: el workflow de GHL aún no tiene mapeada la acción de envío (`{{inboundWebhookRequest.telefono}}` / `.mensaje`, crear contacto, canal activo, workflow publicado). Nuestro código está listo; falta setup del lado de plataformas. Cuando confirmen → reenviar prueba a +573017907593 y pegar `GHL_WEBHOOK_URL` en Vercel.

**Pendientes:** registrar al resto del equipo (ya self-service); validar bloque B con Marcelo (visual, reunión con anterior); registrar tareas por WhatsApp entrante (bloque D, depende de GHL).

---

## 2026-07-11 — WhatsApp de recordatorios y post-reunión vía GHL

**Decisión: canal WhatsApp = GoHighLevel (GHL), no Twilio.** Ya se paga GHL en Ikigai, no hay que aprobar plantillas con Meta, y el mensaje se puede editar dentro de GHL. Project360 NO habla WhatsApp directo: postea a un **Inbound Webhook** de un workflow de GHL (`GHL_WEBHOOK_URL` en Vercel) y GHL envía. Helper `api/_ghl.ts` (prefijo `_` → Vercel no lo enruta). Enganchado en el **cron de recordatorios** y en el **post-reunión**: si la persona tiene teléfono y hay webhook, se manda WhatsApp **además** del email; sin teléfono o sin webhook → se omite (email intacto). Nuevo campo `telefono` por miembro: **migración 023** (`team_members.telefono`) + captura en el modal de invitar y en el detalle del miembro (formato internacional +57). Payload a GHL: `{ tipo, nombre, telefono, mensaje, link, clientId, tareas[] }`. Commit `3c11489`. **Pendiente de ella:** correr migración 023, crear el workflow con Inbound Webhook en GHL (canal WhatsApp activo), pegar `GHL_WEBHOOK_URL` en Vercel, y poner teléfonos a los miembros.

---

## 2026-07-09 — Recuento enlazado entre reuniones

Al abrir una reunión, el MeetingDrawer muestra arriba un **"Recuento de la reunión anterior"** (mismo cliente): los compromisos de la reunión previa con su estado actual — **cumplida / vencida / pendiente / sin registro** — resuelto contra las tareas vivas por coincidencia de título. Resumen "X/Y cumplidos · N por revisar" y aviso para dar seguimiento a los abiertos. **Sin tokens** (data que ya teníamos: `meeting.extractedTasks` + estado de `tasks`). Componente `MeetingRecap.tsx`, visible también en modo lectura (equipo). Así cada reunión arranca revisando lo que quedó pendiente. Commit `d52571b`.

---

## 2026-07-09 — Post-reunión: enviar a cada responsable sus tareas por correo

Al confirmar las tareas extraídas de una reunión (MeetingDrawer), aparece un botón **"Enviar a responsables"** que manda **un correo por persona** con SUS tareas de esa reunión y enlace directo a cada una. Reusa el motor Resend de los recordatorios y resuelve el responsable por **nombre O rol** (mismo criterio del cron). Es **botón manual, no automático**: da control y evita envíos duplicados al reabrir la reunión. Endpoint nuevo `api/enviar-tareas-reunion.ts` (Edge) con auth: owner de la agencia O miembro del cliente. Servicio `src/services/sendMeetingTasks.ts`. **OJO:** hasta verificar el dominio en Resend, los correos solo llegan al correo propio (modo test) — igual que los recordatorios. Commit `8ae89ed`.

---

## 2026-07-08 (noche) — Recordatorios por email EN PRODUCCIÓN + fixes de deep-link

**Recordatorios por email VIVOS y validados E2E.** Vercel Cron diario (8am CO) → `api/cron/recordatorios.ts` (Edge, Resend HTTP). A cada persona UN correo con sus tareas que vencen hoy o en 2 días; cada tarea **enlaza directo a su detalle** (`?task=id`). Correo con `CRON_SECRET` (secret simple `probar123456` tras líos con el valor original) — se puede disparar manual con `curl -H "Authorization: Bearer <secret>" .../api/cron/recordatorios`; `?debug=1` da diagnóstico seguro (sin revelar valores).

**Aprendizaje clave — las tareas se asignan por ROL, no por nombre:** el matcheo responsable→email debe resolver por `nombre` y, si no, por `rol` (slug: strategist, copywriter, project_manager…); un rol puede tener varias personas → se avisa a todas. Al principio fallaba con "sin email de responsable" por esto.

**3 bugs de deep-link corregidos (afectaban toda la app, no solo el correo):**
1. **LoginPage** ignoraba el destino → tras entrar iba siempre a `/`. Ahora respeta `state.from` (con search) → el link de la tarea sobrevive al login.
2. **Auto-abrir `?task=`** borraba el query param al abrir → el modal no se quedaba. Ahora abre una vez por taskId con un ref, sin tocar la URL.
3. **RAÍZ:** `ClientBrainPage` se montaba antes de que el bootstrap cargara los clientes reales → buscaba el id en el seed → no lo hallaba → `Navigate('/')` (caía al dashboard). Fix: `useClientStore.hydrated` (true tras bootstrap) + loader hasta cargar; solo rebota si el cliente no existe de verdad.

**Resend en modo prueba:** sin dominio verificado solo entrega al correo de la cuenta (`pmmarisolochoa@gmail.com`). **Pendiente:** verificar un dominio en Resend + actualizar `RESEND_FROM` → los recordatorios llegan a todo el equipo con su email real.

**Decisión de canal:** email (Resend) para recordatorios disparados por la app (ligados a tareas, con deep-link). Para WhatsApp cuando se entre a ese bloque: usar **GoHighLevel** (Ikigai ya lo paga y hace WhatsApp) en vez de montar Meta/Twilio.

**Siguiente:** verificar dominio Resend (equipo); luego elegir WhatsApp vía GHL, o post-reunión (enviar tareas al terminar) + no-duplicar-tareas.

---

## 2026-07-08 — Fase de SISTEMATIZACIÓN de procesos: arranque + PM aprobado + móvil + recordatorios

**Contexto:** se abrió la fase de sistematizar y ejecutar procesos (objetivo: que el equipo esté al tanto de sus procesos, KPIs, objetivos, resultados, tareas y reuniones; simple y replicable para cualquier agencia). Investigación (3 agentes) confirmó: la app YA tiene el **motor** (agente PM con proponer→aprobar→ejecutar, plantillas de embudo que generan 20-40 tareas, loop reunión→tareas→ROPRE, catálogo KPIs por rol) y los procesos de Ikigai están **documentados pero fragmentados** en Notion/Drive (Ventas 8/10, Onboarding 7/10, método Ikigai; Ads/contenido/RRHH flojos). El "Agente SOP" del menú NO sistematiza — es un cuestionario de viabilidad.

**Roadmap acordado (bloques):** A) Fundación (proceso PM, cómo se conecta la info) · B) Inteligencia de reuniones (no duplicar tareas, recuento enlazado, tiempos) · C) Vista del equipo · D) Recordatorios email+WhatsApp · E) Móvil. Orden: A+E primero, luego B/C, D al final (WhatsApp gasta plata → se pospone).

**Proceso PM APROBADO (fundación):** Inicio (revisar urgente) → 11:00 Daily (wins→números→ronda por área→bloqueos→compromisos) → Estrategia por cliente → Post-reunión (compromisos→tareas con responsable Y fecha) → Seguimiento durante el día → Cierre. Columna vertebral de datos: todo cuelga de CLIENTE (reuniones→tareas+ROPRE→KPIs→reporte) y de PERSONA (ve solo lo suyo).

**Móvil EN PRODUCCIÓN:** sidebar colapsable (cajón + hamburguesa) + header responsive; menú del cerebro del cliente = solo íconos en móvil. La app ya se ve bien en celular.

**Recordatorios por email CONSTRUIDO (rama `feat/recordatorios-email`, pendiente encender):** Vercel Cron 1x/día (8am CO) → `api/cron/recordatorios.ts` (Edge, Resend vía HTTP). A cada persona UN correo con sus tareas que vencen hoy o en 2 días (agrupado, sin spam). Decisión: **email primero** (gratis/rápido) sobre WhatsApp (cuesta por mensaje + setup Meta). Requiere que la founder cree cuenta Resend + agregue `RESEND_API_KEY`/`CRON_SECRET`/`RESEND_FROM` en Vercel; luego merge a main (el cron solo corre en prod) + prueba manual. OJO: `onboarding@resend.dev` solo entrega al correo propio; para el equipo hay que verificar dominio.

**Pendiente de la fase:** encender recordatorios (tras Resend); post-reunión (enviar tareas al terminar); no-duplicar tareas + recuento enlazado entre reuniones; dónde guardar informes de reunión en la nube; WhatsApp + registrar tareas por WhatsApp (decisión de $$); reuniones de equipo (rama `feat/reuniones-equipo` parqueada — la founder prefirió no cambiarlo por ahora).

---

## 2026-07-07 — Barra de búsqueda global (owner + miembro) EN PRODUCCIÓN

**Qué:** La barra de búsqueda del header (que era un input muerto, sin handler) ahora funciona, y el miembro también la tiene en su cabecera.

**Diseño (Opción A — desplegable al instante):** busca del store ya cargado (sin backend → instantáneo) en **Clientes · Tareas · Reuniones · Entregables/links · Personas del equipo**. Resultados agrupados, teclado (↑↓/Enter/Esc), clic para navegar (cliente / tareas / agenda / equipo; los entregables abren su URL). **Se filtra sola por permisos:** el miembro solo tiene en memoria los datos de sus clientes. Se descartaron ⌘K (paleta) y página de resultados por ahora.

**Piezas:** componente reutilizable `GlobalSearch` (en header del owner y del miembro); nuevo `useLinksStore` + carga de `task_links` en el bootstrap (antes solo se cargaban on-demand en /mi-espacio). Validado en preview de Vercel por la founder antes del merge (flujo: rama → preview → revisar → merge).

**Estado del equipo Ikigai:** 2 personas de alta vía botón Invitar; por ahora no se agregan más.

---

## 2026-07-06 — Fix: reuniones de tipo nuevo no se guardaban (+ reuniones en el espacio del miembro)

**Síntoma:** las reuniones que la founder creaba no llegaban al dashboard del miembro. Se veían en el navegador del dueño pero no en la base ni para el equipo.

**Dos hallazgos:**
1. **El espacio del miembro (`/mi-espacio`) no mostraba reuniones** — nunca se construyó esa sección. Se agregó "Reuniones" agrupadas **por cliente**: próximas arriba (con "Unirse" si hay link), recientes/pasadas debajo atenuadas y marcadas "realizada" (hasta 4 por cliente). Datos ya venían por bootstrap (RLS `meetings_client_read`).
2. **Bug raíz de persistencia:** `meetings.type` tenía un CHECK con solo 6 tipos viejos, pero la app ya ofrece 8 (agregó `weekly_planning` y `ropre_strategy`). Crear una reunión de tipo nuevo → INSERT rechazado por el CHECK → **el cliente tragaba el error en silencio** (`addMeeting` hacía `.catch(console.warn)`), así que el dueño la veía local pero nunca se guardaba.

**Fix (migración 022):** se elimina el CHECK de `meetings.type` (el tipo válido lo controla el front, union `MeetingType`); no se vuelve a romper al agregar tipos. Mismo criterio que la 001. **Aprendizaje:** cada vez que se agrega un valor a un union de TS que mapea a una columna con CHECK/enum en Postgres, hay que ampliar/quitar la restricción — si no, el INSERT se rechaza en silencio.

**Prevención:** `addMeeting`/`updateMeeting` ahora muestran **toast de error** si el guardado falla → nunca más pérdida silenciosa de datos. (Patrón a replicar en otros stores que hoy hacen `.catch(console.warn)`.)

**Validado en prod** por la founder: reunión de tipo `ropre_strategy` se guarda y el miembro la ve.

---

## 2026-07-06 — Botón "Invitar miembro": alta de equipo self-service EN PRODUCCIÓN

**Qué:** El owner ya da de alta miembros **desde la app** (módulo Equipo → "Invitar miembro"), sin crear usuarios a mano en Supabase. Cierra el pendiente "botón invitar" del Slice 2.

**Decisión técnica (seguridad):** crear un login requiere la **service role key**, que jamás puede vivir en el navegador → se hizo una **Edge Function** (`api/invitar-miembro.ts`, hermana de `api/claude.ts`). La función: (1) verifica el token de quien invita, (2) confirma que **es el owner de la agencia dueña del cliente** antes de crear nada, (3) crea el usuario Auth (contraseña temporal) + `public.users` (role `'team'`, respeta el check de la tabla) + `team_members` con departamentos + editor/viewer. Si falla un paso, **rollback** del usuario Auth. La llave vive **solo en Vercel** (`SUPABASE_SERVICE_ROLE_KEY`).

**Modelo de acceso reunido en el formulario:** correo, nombre, rol, **departamentos** (checkboxes PM/Finanzas/Content = qué módulos ve) y **editor/viewer** (qué puede editar). Contraseña temporal generada en la UI (se copia y se pasa por WhatsApp; el miembro la cambia). Se eligió clave temporal sobre email de invitación para no depender de deliverability de correos.

**Detalle:** `addLocal` en `useTeamMembersStore` muestra al invitado sin re-insertar (la fila ya la creó el backend → evita duplicar). El botón "Agregar persona" (solo KPIs, sin login) se conserva aparte.

**Validado E2E en prod** por la founder. Alta de equipo ya no es manual.

**Próximos pasos:** dar de alta al equipo real de Ikigai con sus departamentos; opcional: migrar a email de invitación, UI para ver/editar departamentos de un miembro ya creado, y la "carrocería" de pestañas por departamento (Opción B) si al usar el filtro simple se extraña.

---

## 2026-07-06 — Departamentos como "lente" de navegación (Opción A) EN PRODUCCIÓN

**Qué:** Se agregó una capa de **departamentos** (PM · Finanzas · Content) que decide qué módulos del cerebro del cliente ve cada persona. Desplegado a producción (main → Vercel).

**Decisión de dirección (clave):** los departamentos **no son dashboards ni módulos duplicados** — son una **lente** (un filtro) sobre el único set de módulos que ya existe (`BRAIN_MODULES`). Se rechazó explícitamente duplicar dashboards por departamento (se desincronizarían) y montar un servidor/BD aparte para Ikigai (dos copias que se separan). El aislamiento por agencia (`agencia_id` + RLS) se pospone hasta tener una **2ª agencia pagando** (Fase 3 SaaS); Ikigai corre en la instancia actual porque es el **caso de prueba**, no una venta externa.

**Modelo confirmado (dos ejes independientes):**
- **Nivel de acceso:** owner (ve todo) vs. member (ve lo asignado). *Ya existía.*
- **Departamentos:** lista por persona (multi-departamento). Lo que ve = **unión** de los módulos de sus departamentos, sin duplicar los compartidos (Perfil/Tareas/Equipo). *Nuevo.*
- **editor/viewer** (quién puede editar) queda intacto — es un tercer eje aparte, no se tocó.

**Construido (Slice 1 — solo el filtro de navegación):**
- Registro único `DEPARTMENTS` en `src/config/departments.ts` (fuente de verdad de qué módulos trae cada departamento).
- `BrainNav` filtra el menú por la lista del miembro (`moduleSlugsForDepartments`, unión). **Red de seguridad:** sin departamentos asignados → cae al set de miembro previo (`MEMBER_MODULE_SLUGS`) → cero regresión.
- Migración **021**: columna `team_members.departamentos` (jsonb, aditiva, no toca RLS ni datos). Asignación aún manual por SQL (como el alta de miembros).
- **1ª prueba real:** Juan Camilo Correa → `['pm','finanzas','content']` = vista completa (9 módulos), sin convertirlo en owner de agencia.

**Se pospuso deliberadamente (Opción B — carrocería):** la UI del mockup `departamentos-navegable.html` (pestañas de departamento arriba + menú lateral) es solo cosmética sobre el mismo motor; se hará después si al usar A se prefiere ese look. UI para asignar departamentos desde la app también queda para después.

**Próximos pasos:** validar el filtro con Juan (5→9 módulos), probar el corte con `['finanzas']` (solo 3 módulos), decidir si se agrega la carrocería (B), empaquetar Fase 1 = departamento PM para Ikigai.

---

## 2026-07-02 — Capa 1: dashboard del miembro EN PRODUCCIÓN + fix de persistencia reuniones/ROPRE

**Qué:** Se construyó, validó y **desplegó a producción** (main → Vercel) el espacio de trabajo del miembro del equipo (Capa 1, multi-cliente), y se corrigió un bug de fondo que impedía compartir datos entre owner y equipo.

**Decisión de dirección:** el miembro del equipo trabaja en **varios clientes** (una persona sirve a varios) → el modelo es un **dashboard personal multi-cliente**, no scopeado a 1 cliente. Se adaptó el spec (que asumía un esquema `profiles`/columnas inexistentes) al esquema real, **reusando** la auth de Camino C. La app estaba más avanzada de lo que el spec suponía; no se reconstruyó nada.

**Construido y en vivo (Slice 1 + ajustes):**
- Auth multi-cliente (`resolveUserContext` → lista de clientes); ruta `/mi-espacio` (saludo, métricas propias, entregas urgentes, últimos links).
- **Flujo de entregables:** el miembro sube link de Drive → `tasks.drive_link` + tabla `task_links` (migración 019/019b) → el PM lo ve.
- Tema claro/oscuro para el miembro; sección "Mis clientes" → cronograma de tareas (Kanban/Lista/Gantt).
- Miembro limitado a 5 módulos del cliente: **Perfil, Tareas, ROPRE, Agenda, Equipo/KPIs** (resto oculto + candado por URL).

**Bug grande arreglado (afectaba también al owner):** reuniones y ROPRE **no persistían a Supabase** (se perdían al recargar; los miembros no las veían). Causas: (a) faltaban policies de lectura para miembros → **018c**; (b) `ropre_items` sin columnas `linked_task_id/last_edited_in_meeting_id/last_edited_at` → cada INSERT fallaba → **020**. Aprendizaje: la BD prod había corrido versiones previas de la 018 → varios parches (018b/018c).

**Registro de personas:** flujo manual en Supabase (crear user en Auth → fila gemela en `public.users` → ligar en `team_members` con `access_level`). **1ª persona real dada de alta:** Juan Camilo Correa (funnel_builder, editor). El botón "invitar" se automatizará en Slice 2.

**Próximos pasos:** registrar al resto del equipo de Ikigai; observar uso real; Slice 2 (aprobación PM, "Mis tareas" con filtros, KPIs personales, botón invitar) sobre feedback real.

---

## 2026-06-30 — Capa 3: acceso de cliente/equipo a la app (Camino C) — Fase 1+2

**Qué:** Se decide habilitar que usuarios externos (equipo de Ikigai) **inicien sesión y entren a la app**, no solo reciban reportes. Es Camino C (multi-tenant del lado cliente). *Nota: contradice parcialmente la decisión del 24 jun ("no construir multi-tenant hasta ≥3 paguen"); se asume conscientemente porque el dogfooding con Ikigai requiere que el equipo entre y use la app de verdad. La validación de pago sigue pendiente.*

**Caso de uso:** equipo de Ikigai con **dos roles** — unos **ejecutan** tareas (`editor`) y otros **revisan** (`viewer`).

**Implementado (Fase 1+2, sin features nuevas de producto):**
- **Migración 018** (escrita; pendiente correr en prod): login de cliente con RLS por cliente. Endurecida: editar tareas requiere `is_client_editor` (un `viewer` no puede modificar ni a nivel BD).
- **Detección de rol** (`resolveUserContext`): al loguear, la app distingue *owner de agencia* vs *miembro de cliente* (vía `team_members.user_id`). Store de auth extendido con `role` + `clientAccess`.
- **Router del miembro:** un miembro queda encerrado en el cerebro de SU cliente — no llega al dashboard de agencia ni a otros clientes (`MemberLayout` slim, sin sidebar de agencia; blindaje por id en `ClientBrainPage`).
- **Modo lectura/edición** (`useClientMode`): el Agente PM se oculta para miembros; `viewer` ve Tareas en solo-lectura (sin crear/mover/borrar), `editor` con interacción completa.

**Verificado:** `tsc --noEmit` + `npm run build` limpios.

**Fase 2.5 (solo-lectura por módulo) — HECHA mismo día:** todos los módulos del cerebro (Perfil, Proyección, Métricas, ROPRE, Agenda+MeetingDrawer, Equipo, Programas, Planeación+FunnelLaunchPanel, Contenido) reciben `readOnly` y ocultan/deshabilitan crear/editar/eliminar/IA cuando el usuario es miembro. Solo Tareas queda editable para `editor`. Criterio: miembro = lectura en todo salvo Tareas (RLS solo concede UPDATE de tasks). Verificado con `tsc` + `build` limpios (13 archivos blindados; ningún `readOnly` default true → owner intacto).

**Pendiente para que el equipo entre (no-código de Marisol):** (1) correr migración 018; (2) crear usuarios en Supabase Auth; (3) ligar cada usuario a Ikigai en `team_members` (user_id + access_level). **Fase 3** (botón "invitar miembro" desde la app) queda como siguiente paso opcional.

---

## 2026-06-24 — Decisión de dirección: validar y monetizar antes de seguir construyendo

**Qué:** Cambio de foco estratégico. La app está más avanzada de lo que la narrativa interna ("MVP a medias") sugería — 100+ commits, cliente real en prod (Marcelo), Agente PM vivo, reportes PDF, equipo con KPIs, generador de anuncios IA. El riesgo dejó de ser "falta feature" y pasó a ser **scope creep / sobre-pulido**. Se decide **frenar features nuevas y entrar a validación + monetización**.

**Decisiones clave:**
- **Modelo de entrada = Camino A (Done-for-you).** La founder opera Project360 *a mano* para 2 agencias externas (2 semanas gratis cada una, entregando reportes ejecutivos + gestión ordenada). Cobra consultoría, no software. **No** se construye onboarding/pagos/multi-tenant (Camino C) hasta tener ≥3 personas dispuestas a pagar. Razón: valida *disposición a pagar* sin escribir código.
- **Congelar features.** Desde hoy solo se arreglan bugs que bloqueen a un usuario real. Nada nuevo hasta que alguien externo use la app.
- **Métrica de validación:** que al final de las 2 semanas el cliente pregunte "¿cuánto te pago por seguir?". Si no lo pregunta, el problema era de valor, no de pulido.
- **Límite de capacidad:** máximo 2 externos a la vez (operación manual no escala más).

**Lista de candidatos priorizada** (dolor confirmado × cercanía × encaje):
1. 🥇 **Launch Xpert** (agencia de lanzamientos, cercanía 4) — dolor **confirmado**: cuello de botella en sistematización, **no tienen reporte ni gestión de cliente**. Encaje perfecto. → Contactar #1.
2. 🥈 **Andres Alzate** (tiene agencia, cercanía 5) — dolor por confirmar. → Contactar #2.
3. 🥉 **Jhonatan Rengifo** (freelance, varios proyectos, cercanía 5) — dolor por confirmar. → Reserva.
4. **Maryori** (freelance, marca personal, cercanía 5) — encaje medio (1 cliente). → Reserva.
- ⭐ **Ikigai** (negocio propio de la founder, growth marketing) — dolor confirmado (estrategias que se proponen y no se ejecutan). **NO es venta → es dogfooding:** usar Project360 en Ikigai esta semana; se vuelve el mejor caso de estudio para vender después.

**Plan de la semana:** (1) usar la app en Ikigai; (2) mandar pregunta de validación a Launch Xpert y Andres (sin vender); (3) al que se queje, oferta de 2 semanas gratis; (4) medir a las 2 semanas.

**Por qué:** la duda de la founder ("¿pulir más o no?") era señal de la trampa de sobre-construir. Validar disposición a pagar con la persona correcta (Launch Xpert) es el siguiente experimento de mayor valor y casi sin costo.

---

## 2026-06-23 (noche) — Reunión real de Marcelo, bug de compromisos y KPI tarea↔Equipo

**Qué:** Continuación operando con Marcelo. Cada cambio con commit + push a `main`:

1. **Cargada la 1ª reunión real de Marcelo** (su `.md` → Notas → "Extraer tareas" → 7 tareas en el Kanban). Se confirmó el flujo de captura de reunión en la app.
2. **Bug corregido (importante):** al confirmar las tareas extraídas, el código hacía `updateMeeting({extractedTasks: []})` — **borraba los compromisos justo después de crearlos**, por lo que el reporte nunca mostraba "Decisiones". Ahora se persiste la lista confirmada; el borrador local ya no se inicializa desde el registro (evita re-crear al reabrir); `markDone` no re-extrae si ya hay compromisos (evita duplicados). Se **backfilleó** la reunión de Marcelo (7 compromisos reconstruidos desde las tareas existentes, sin duplicar).
3. **KPI de tarea ↔ Equipo conectado** (pendiente cerrado): los `kpiResultado` de tareas completadas alimentan la tarjeta de cada persona en "Salud del equipo" (contador `🎯 N/M resultados` + sección "Resultados de tareas" en el detalle + integrados al score/semáforo). Match por nombre o rol. Ver [[project_pending_task_kpi_to_team]] (HECHO).

**Decisiones clave:**
- **Reportes NO se archivan en la app** (opción C): se descargan a la compu; cada cliente organiza su espacio. Construir historial de reportes (Supabase Storage + tabla `reports`) solo si un cliente lo pide. Ver [[project_pending_reports_archive]].
- **Compromisos de reunión = fuente de las "Decisiones"** del reporte: se guardan en `meetings.extracted_tasks`; el fix garantiza que sobrevivan a recargar.

**Por qué:** validar el ciclo real de operación (reunión → tareas → reporte → equipo) con el primer cliente; el camino destapó un bug de persistencia que afectaba a todos los clientes.

**Próximos pasos abiertos:**
- Auto-fill de KPIs desde Meta cuando Marcelo tenga pauta (ad account del cliente, no el personal) — [[project_pending_meta_kpi_autofill]].
- Capa 3 multi-tenant (al final).
- Opcional: campo "Resumen" de reunión para que las Decisiones muestren un párrafo en vez del conteo de compromisos.

---

## 2026-06-23 (tarde) — Correcciones: informe de reunión, KPIs de equipo y meta editable

**Qué:** Tres correcciones sobre lo construido, cada una con commit + push a `main`:

1. **Informe de reunión con el diseño del reporte semanal.** Se extrajo `renderReport()` compartido en `htmlReport.ts` y se agregó `exportMeetingReportHTML` (bloques: agenda, minuta, compromisos, participantes). Sustituye al `exportMeetingReport` viejo (jsPDF "SALES BRAIN OS"). Rewireados `MeetingDrawer` y `ReportsMenu`.
2. **Guía de KPIs de equipo** (no fue cambio de código, fue decisión operativa): las metas de KPI por rol vienen de `ROLE_DEFS` (benchmarks fijos); el valor real se carga **a mano** leyéndolo de Meta Ads Manager.
3. **Meta de KPI de rol editable por cliente** (lápiz ✏️): override por persona en `team_members.kpis.targets` (jsonb existente, sin migración); el semáforo escala sus umbrales en proporción; badge "editada".

**Decisiones clave:**
- **Un solo motor de informes:** todos los reportes (semanal, reunión, futuros) comparten `renderReport` (portada Project360 + header/footer nativos + color por cliente). Se cambia el diseño en un lugar y se propaga.
- **KPIs de equipo: manual durante el lanzamiento de Marcelo**, automatizar cuando haya ads activos (hoy traería ceros). Plan: botón "Traer de Meta" vía MCP.
- **⚠️ Caveat registrado:** la cuenta conectada al MCP de Meta (`act_2627339060997463`) es la cuenta **personal** de la founder, NO la de Marcelo/clientes. El auto-fill por cliente exigirá guardar el ad account propio de cada cliente (campo nuevo en `clients`) + token con acceso. Ver [[project_pending_meta_kpi_autofill]].
- **Metas editables sin migración:** se reusó el jsonb `kpis_custom` (clave nueva `targets`) en vez de columna nueva — cero riesgo en la BD.

**Por qué:** unificar la calidad de los entregables al cliente (todos los informes iguales) y dar flexibilidad operativa real (metas distintas por cliente) sin sobre-ingeniería.

**Próximos pasos:**
- Cuando Marcelo tenga pauta corriendo: construir "Traer de Meta" para KPIs (con el ad account del cliente, no el personal).
- Pendientes previos siguen abiertos: KPI tarea ↔ Equipo, cargar reunión de Marcelo, capa 3 multi-tenant.

---

## 2026-06-23 — Agente Project Manager (Nivel 1) dentro de la app

**Qué:** Se construyó el primer **agente IA conversacional** dentro de Project360: un Project Manager que vive en el cerebro de cada cliente, lee su contexto real y puede proponer acciones (crear tareas, actualizar ROPRE, agendar reuniones) con aprobación del usuario. 5 secciones, cada una con commit + push a `main`:

- **S1 — Catálogo de agentes:** tabla `agent_prompts` (agente, nombre, ícono Lucide, system_prompt, modelo, activo) + seed del agente `pm` (migración **016**).
- **S2 — Chat reutilizable:** componente `AgentChat` (genérico: recibe `clientId` + `agente`) + servicio `agentService.ts` que arma el **contexto del cliente** (perfil/oferta/buyer persona, programa/embudo activo, ROPRE, tareas próximas/vencidas, equipo con % cumplimiento, últimas 2 reuniones ≤500 palabras) + persistencia del historial en `agent_conversations` (migración **017**). Backend: feature `agent_chat` multi-turno en `api/claude.ts` (`callAnthropicChat`).
- **S3 — Acciones con aprobación:** el agente emite un bloque `[ACCION]{json}[/ACCION]`; el frontend lo convierte en una `ActionCard` con `[Editar]`/`[Confirmar y crear]` que ejecuta el INSERT real **reusando los stores existentes** (`addTask`, `useRopreStore.add`, `addMeeting`). Nada se guarda sin confirmación.
- **S4 — Integración:** botón flotante (esquina inferior derecha) + panel lateral deslizante (`AgentPanel`, portal a `document.body`), global a todos los módulos del cerebro — no es un tab, no se pierde el lugar.
- **S5 — Puente a funciones existentes:** `agentTools.ts` detecta la intención ("genera las tareas de la reunión") y reutiliza `extractTasksFromNotes()` sobre la última reunión con notas/transcripción, proponiendo cada tarea como tarjeta. Los botones del `MeetingDrawer` quedan intactos — el chat es un canal ADICIONAL.

**Decisiones clave:**
- **Sin `agencia_id` / multi-tenant** — todo se ancla por `client_id`, igual que el resto del proyecto. Es deuda técnica intencional ya documentada (se activa cuando haya una 3ra agencia pagando).
- **Prompts en la BD, no hardcodeados** (`agent_prompts`): permite editar la personalidad/modelo del agente sin redeploy y escalar a más agentes (`copy`, `content`, `trafficker`) agregando filas. Hay un **prompt de respaldo** en código por si la BD no está disponible (el chat nunca se rompe).
- **El protocolo de acciones vive en el código** (no en el system_prompt de la BD): el texto `[ACCION]` se inyecta en runtime junto al parser, para que formato y parser nunca se desincronicen.
- **Reusar, no duplicar:** las acciones y el puente llaman a las mismas funciones/stores que ya usaban los módulos — el agente es otra puerta de entrada, no una implementación paralela.
- **Degrada con elegancia:** sin migraciones el chat funciona (prompt de respaldo, sin historial persistido); sin API key responde error en burbuja sin tumbar la app.

**Por qué:** dar a la founder/PM un copiloto que ya conoce el estado de cada cliente, para operar más rápido (resúmenes, tareas, ROPRE) sin salir del cerebro del cliente. Es la base del sistema multi-agente (PM es el Nivel 1).

**Validación:** migraciones 016 + 017 corridas en prod; verificado E2E con **Marcelo Duarte** — el agente respondió un plan semanal referenciando el webinar del 29 jul (lee contexto real), propuso una tarea con tarjeta de confirmación (no la creó sola) y persistió la conversación en `agent_conversations`.

**Implicaciones / Próximos pasos:**
- Siguientes agentes (Copy, Content, Trafficker): basta agregar filas a `agent_prompts` y reusar `AgentChat`.
- Pendiente probar el canal de extracción de tareas (S5) cuando Marcelo tenga una reunión con notas cargada.

---

## 2026-06-22/23 — Primer cliente real + rediseño del reporte + módulo Equipo

**Qué:** Sesión de uso real de la app (no demo). Tres bloques:

1. **Walk-through E2E del Sprint E** — validado en prod sin errores (login, programas, KPI por tarea, reporte, portal). 1 mejora detectada y anotada (conectar KPI de tarea ↔ Equipo).
2. **Marcelo Duarte cargado como primer cliente real** (vía SQL en prod, `supabase/seeds/cliente_marcelo_duarte.sql`): cliente + programa "Lanzamiento Webinar GOBERNA" (evento 29 jul, meta 300 a WhatsApp / USD 10.000 a ticket $497) + embudo (4 fases) + ROPRE + 8 tareas reales + equipo. Agencia operando: LaunchXpert LLC. Ver [[project_marcelo_duarte_real_client]].
3. **Rediseño del Reporte Ejecutivo** (nuevo motor `src/services/htmlReport.ts`) y **reconstrucción del módulo Equipo**.

**Decisiones clave:**
- **Reporte: motor HTML → PDF** (html2canvas + jsPDF) en vez del jsPDF manual. Diseño basado en la referencia de la CEO (banda oscura, ROPRE 5 columnas, KPI cards, plan, hitos). **Identidad Project360** (dark + violeta + gradiente) con **firma de color por cliente** (`--accent`/primaryColor). **Documento paginado de verdad:** header/footer nativos en cada página con "Pág X de N", secciones capturadas como bloques y acomodadas sin cortarse. Sustituye al reporte semanal anterior.
- **Decisiones del reporte** salen de las **reuniones** del cliente (si no hay, la sección se omite). Pendiente: capturar reuniones de Marcelo.
- **Módulo Equipo — dos sistemas unificados:** se ocultó el dashboard role-based legacy (datos sembrados de prueba) y se reconstruyó **"Salud del equipo" con datos reales** (cumplimiento, carga, cuellos de botella, gráfica) sobre el sistema nuevo `team_members` + `useTeamKPIs`. Equipos por **rol placeholder** (cada cliente asigna su gente real); se agregó edición de nombre/email en el detalle. Funciones completas por rol restauradas vía SQL (`equipo_funciones_completas.sql`).
- **Orden estratégico confirmado por la CEO:** ① operar con clientes reales primero (impacto y aprendizaje) ② reporte (lo que el cliente recibe = máximo impacto) ③ pulido interno ④ **capa 3 multi-tenant al final** (cuando se venda a otras agencias).

**Por qué:** empezar a usar la app con proyectos reales (prioridad #1 del MVP) y dejar el entregable cliente (reporte) a nivel "CEO".

**Implicaciones / Próximos pasos:**
- Cargar una **reunión** de Marcelo para que aparezcan las Decisiones en el reporte.
- **Conectar KPI de tarea ↔ módulo Equipo** ([[project_pending_task_kpi_to_team]]).
- **Capa 3 — multi-tenant** (agencies con login + RLS por agencia + panel admin): planeada en 4 fases, pendiente. El cimiento existe (tabla `agencies` + `owner_id` + políticas RLS en mig. 004), pero RLS está apagado (permisivo) en beta.

---

## 2026-06-19 — Sprint E: features de operación para el beta (6 secciones)

**Qué:** Sprint grande sobre la app, 6 secciones en el orden que pidió el CEO, cada una con commit + push a `main`:

- **S0 — Planeación/Métricas/Proyección:** oculté Investigación de Mercado y Sistema de Embudos de Planeación (link a Programas); arreglé el contraste de los escenarios; nota colapsable "cómo se calculan"; **selector de moneda COP/USD/EUR** (persistido por cliente); quité "Vs Mercado"; Métricas en 2 columnas + Indicadores de rendimiento; quité el tab Contenido.
- **S3 — Equipo con personas + KPIs:** tabla `team_members` (mig. 013), agregar personas (nombre/rol/email), funciones editables (chips), KPIs del rol con valor manual + semáforo, KPIs personalizados (manual/auto), hook centralizado `useTeamKPIs`.
- **S4 — Programas:** tabla `programs` + `program_id` en tasks/funnels (mig. 014), tab Programas (resumen + cards), crear programa con materialización de embudo vinculado, filtro por programa en el Kanban.
- **S5 — KPI por tarea:** columnas kpi_* en tasks (mig. 015), sección "Resultado esperado" en el drawer, captura al completar, display en cards con semáforo.
- **S2 — Onboarding editable:** botón "Editar información del cliente" → 8 secciones editables con guardado inmediato.
- **S1 — ROPRE en el PDF semanal:** feature `ropre_weekly` (claude-haiku-4-5) + fallback heurístico, página ROPRE (semáforo + R/O/P/R/E + recomendación PM), columna "Resultado" en completadas.

**Decisiones clave:**
- **No reescribir lo que funciona** — todo se construyó encima (el dashboard de roles, el funnel roadmap y el reporte existente quedaron intactos).
- **Tokens CSS:** el spec pedía `--color-text-*` que NO existen; se usaron los reales (`--text-primary`, etc.). Sin esto el contraste no funcionaba.
- **Moneda (0C.4):** aplicada solo al Funnel financiero (base USD), NO a las metas de revenue del cliente (que van en su propia moneda).
- **Métricas avanzadas (0D)** y **ROPRE IA (S1):** degradan a "—"/heurística cuando faltan datos o la IA falla — nunca bloquean. El modelo demo de Métricas no tiene compras/visitas/video; quedan pendientes de extender el generador demo o conectar Meta real.
- **Ejecución 100% inline:** el subagente `dev` no tiene permiso de escritura en modo aprobación-manual, así que todos los edits los hizo el agente principal con aprobación de la CEO.

**Por qué:** preparar la app con las features operativas (equipo, programas, KPIs, reporte ROPRE) que el CEO necesita para operar con el equipo durante el beta.

**Implicaciones / Próximos pasos:**
- **Pendiente CEO:** correr la migración **015** en Supabase (las 013/014 ya corrieron) para que los KPIs de tarea persistan.
- **Pendiente CEO:** walk-through E2E del flujo nuevo (crear programa → tareas → KPI → completar → resultado).
- Decisión abierta: extender el generador demo de Métricas para que 0D se vea lleno (vs. esperar a conectar Meta real).

---

## 2026-06-16 — Sprint D: app lista para beta con 2 agencias

**Qué:** Se completó el Sprint D para dejar el flujo crítico **crear cliente → elegir embudo → generar tareas → reporte semanal** funcionando end-to-end sin errores, listo para probar con 2 clientes beta (una agencia + una marca personal). Cuatro secciones, cada una con commit + push a `main`:

1. **Kanban** — drag&drop nativo pulido con toast al mover, eliminar tarea inline desde la card (confirmación in-card, sin drawer), filtro por roles canónicos en orden fijo (se agregó el rol `project_manager` a `ROLE_DEFS`).
2. **Embudos** — selector de plantilla movido al **final del onboarding** (4 cards + "Omitir"), materialización masiva de tareas en Supabase con barra de progreso, roadmap visual con countdown de 3 niveles (rojo <7d / amarillo <14d / verde ≥14d), persistencia de `active_funnel_id` en la tabla `clients` (migración **012**), share con cliente vía portal público existente (sin tocar `share_token`/ruta `/client-portal/funnel/:token`).
3. **Reporte semanal PDF** — botón "📊 Reporte semanal" genera PDF de 4 páginas (jsPDF + autotable): portada con color de marca, resumen ejecutivo IA, tablas de completadas/pendientes, foco de próxima semana con prioridades IA. Endpoint nuevo `weekly_report` en `api/claude.ts`.
4. **Pulido beta** — errores de onboarding en español, empty states, `ErrorBoundary` global (sin pantallas en blanco), banner de bienvenida personalizado, 2 clientes seed en Supabase prod.

**Decisiones clave:**
- **Modelo IA del reporte: `claude-haiku-4-5`** (no sonnet) — costo ~$0.005/reporte vs ~$0.04, con fallback heurístico si la API falla. El PDF nunca se bloquea por fallo de IA.
- **No se reescribió lo que ya funcionaba** — la mayor parte de la infra (Kanban drag-drop, plantillas, portal, toasts) ya existía; se hicieron ediciones quirúrgicas mínimas.
- **Seed ejecutado en prod vía SQL Editor de Supabase** (solo había anon key local, no service_role): Mared Agency (`seed_leadmagnet`, 5 tareas) + Ikigai Growth (`evergreen_social`, 5 tareas). Confirmado en prod.
- **MCP de Meta Ads agregado** (oficial `@meta/ads-mcp-server`) en config local del proyecto — pendiente que Marisol autentique vía `/mcp` + login de Meta.

**Por qué:** Las 2 agencias beta entran en pocos días; el objetivo era estabilizar el flujo crítico por encima del pulido cosmético.

**Implicaciones / Próximos pasos:**
- **Pendiente de Marisol:** walk-through visual E2E (checklist de 7 pasos) antes de invitar a las agencias.
- **Pendiente de Marisol:** autenticar el MCP de Meta Ads (`/mcp` → meta-ads → login navegador).
- Detalle menor no crítico: el `<title>` en prod aún dice "Sales Brain OS" (nombre viejo) — cambiar cuando se toque el index.

---

## 2026-06-12 — Inicio del workspace (cerebro Project360)

**Qué:** El repo `~/Desktop/CLAUDE/project360/` se convirtió en Cerebro del sistema: CLAUDE.md de workspace (fusionado con el técnico existente), `Contexto.md`, este historial, `Prompts_Maestros/` y `Datos_Entrada/`. Dos decisiones de Marisol al crearlo: (1) **el nombre oficial es Project360** — "BrainSales" era un nombre anterior y se descarta; los dos registros que estaban separados en pendientes eran el mismo proyecto y se unifican; (2) **prioridades:** ① terminar MVP y usarla con el equipo ② estabilizar lo construido ③ prepararla como SaaS.

**Por qué:** Project360 estaba en "pendientes de cerebro" desde la instalación del sistema; tiene scope, historial y herramientas propias (app en desarrollo activo con 81 commits).

**Implicaciones / Próximos pasos:**
- Primera sesión de trabajo: definir con Marisol qué funciona end-to-end vs. qué falta para el MVP (queda como pendiente en `Contexto.md`).
- El material legado `~/Desktop/CLAUDE/cerebro/Projects/brainsales.md` queda migrado (era plantilla casi vacía; lo útil ya está aquí).
# Decisión registrada — Multi-tenant (agencia_id)

**Fecha:** Junio 2026
**Decisión:** NO implementar agencia_id todavía.
**Razón:** Solo 2 agencias en beta (Ikigai, Mared). El costo de
refactorizar todas las tablas ahora no se justifica vs. validar
el producto primero.

**Condición de activación — hacer esto CUANDO:**
- Haya una 3ra agencia pagando (no beta gratis)
- O cuando Ikigai y Mared empiecen a notar fricción real

**Qué falta hacer cuando se active:**
1. Agregar columna agencia_id a: clients, programs, tasks,
   team_members, funnels, meetings, agent_prompts
2. Habilitar RLS en Supabase con policy por agencia_id
3. Activar tabla de medición de tokens por agencia
4. Definir límites de uso de IA por plan