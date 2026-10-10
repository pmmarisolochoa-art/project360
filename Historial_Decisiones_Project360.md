# Historial de Decisiones — Project360

> Log **inmutable** de decisiones de este workspace: dirección, presupuestos, lanzamientos, cambios de rumbo. Más recientes arriba. Las decisiones se agregan, nunca se sobreescriben. Si una decisión cruza ecosistemas → también va a `~/Desktop/CLAUDE/Cerebro_Central/Historial_Decisiones_Centrales.md`.

---

## 2026-10-09 — Modo Reunión: presentación guiada para reuniones, con cierre que crea tareas reales

Encargo de la founder: las reuniones no tenían estructura — cada quien hablaba de lo que se le ocurría. Se construyó un **Modo Reunión**: vista a pantalla completa, diapositiva por diapositiva, con 3 plantillas (Sprint/Planeación/Retro) definidas como **datos editables** en `src/config/meetingTemplates.ts` — agregar/quitar/reordenar un paso es editar ese archivo, no tocar componentes. Construido en 4 fases, cada una probada en navegador antes de seguir:

1. **Motor + plantillas** — navegación (flechas/botones), cronómetro por paso (alerta visual al pasarse, nunca bloquea), indicador de progreso, notas por paso.
2. **Datos reales en revisión** — tareas del cliente por responsable (hecho/en curso/bloqueado) y métricas de contexto (avance, ROAS, inversión), jaladas del mismo store que usa el resto de la app. Las tareas privadas quedan fuera a propósito: esta pantalla se comparte en Meet/Zoom.
3. **El cierre crea tareas reales** — formulario de compromisos (título/responsable/fecha) que usa el mismo camino de creación de tareas de siempre, con `origen:'reunion'` + referencia a la reunión. Las notas por paso se persisten con la reunión (`meetings.modo_reunion_notas`, jsonb) — **migración 063, corrida y verificada en producción** (curiosamente ya estaba aplicada cuando se fue a correr; se confirmó con consulta directa a `information_schema`, no se asumió).
4. **Recuento de semana en la apertura del Sprint** — el primer paso del Sprint ahora trae el objetivo que se planteó en la reunión de Planeación de esa semana (si esa reunión corrió por Modo Reunión, sale de su propio paso "Objetivo" guardado en el 063; si no, de su resumen/agenda), el cumplimiento de tareas de la semana, y un resumen de cada reunión que hubo. Si no hubo Planeación esa semana, lo dice en vez de inventar un objetivo.

**Decisión clave:** la plantilla de presentación quedó **desacoplada** del campo `type` que ya existía en reuniones (el que alimenta reportes y tiene reglas de negocio en otras partes) — se elige aparte, al abrir el Modo Reunión, para no arriesgar ese campo.

**Handoff a Ikigai:** documento completo publicado como Artifact (arquitectura, decisiones, lo que depende del stack de cada quien, lecciones del camino) para que su cerebro nuevo (`~/ikigai-plataforma/`) construya el mismo sistema sobre su propia plataforma — no es código para copiar, es la especificación.

~~**Pendiente:** `src/components/meetingMode/`, `src/config/meetingTemplates.ts` y la migración `063` seguían sin commitear.~~ **CORREGIDO (mismo día):** commit `6be0476`, pusheado a `main` y desplegado — confirmado por el status check de Vercel en GitHub (`Deployment has completed`). Sin pendientes de esta sesión.

---

## 2026-10-10 — Modo Reunión probado en navegador real: 3 bugs encontrados y corregidos

Pedido explícito: "pruébalo tú en la app". Se abrió Playwright contra local, se entró a la reunión real de Alejo Luengas (Sprint de cierre de semana) y se recorrieron las 3 plantillas con sus datos reales — no con datos de ejemplo. Salieron 3 fallos que ninguna prueba automática ni el typecheck hubieran visto:

1. **El paso "Objetivo de la semana" dumpeaba la agenda COMPLETA de Planeación** (cientos de palabras, día por día) cuando la reunión no tenía `summary` — el fallback a `agenda` fue un error de diseño: la agenda es el guion de la semana, no un objetivo corto. **Corregido:** se quita el fallback a `agenda`; si no hay `modoReunionNotas.objetivo` ni `summary`, la diapositiva dice explícitamente que no hay objetivo registrado en vez de inundarse de texto. Los resúmenes de reunión (de Fathom, en markdown con links `[texto](url)`) también se acortan y se les quita el markup — antes de esto se veían los corchetes y URLs en crudo en pantalla.
2. **Loop infinito de renders en el paso de Cierre** ("Maximum update depth exceeded", 108 errores en consola) — el selector de Zustand hacía `.filter()` sobre el array de miembros DENTRO del selector, devolviendo una referencia nueva en cada render. **Corregido:** se selecciona el array completo (referencia estable) y se filtra/deduplica en `useMemo`. Lección reafirmada: un selector de Zustand nunca debe devolver un array/objeto construido inline.
3. **Nombres duplicados en el desplegable de responsables** (dos miembros "Marisol Ochoa" para el mismo cliente) causaban colisión de keys de React. Corregido con deduplicación por nombre en el mismo `useMemo`.
4. **El paso "Contexto" mostraba Avance 0% y ROAS "—" para un cliente que en el Dashboard tiene 48% y 6.9x** — leía directo `client.metrics.progressPercent`/`.roas`, el campo GUARDADO que ya se sabía que no se recalcula (mismo patrón documentado en sesiones anteriores para `salesCount`/`revenueAccumulated`). **Corregido:** ahora usa `avanceForClient()` y `ventasForClient()`, las mismas funciones que ya usa la tarjeta del Dashboard — verificado que los números coinciden exactamente (48% / 6.9x) tras el fix.

**Verificado además:** la tarea de prueba creada desde el Cierre sí quedó en Supabase (`origen:'reunion'`, `meeting_id` enlazado) — se confirmó por consulta directa y se borró después por ser de prueba. Consola en 0 errores en las 3 plantillas tras los 4 fixes. Commiteado junto con el cierre del pendiente anterior.

---

## 2026-10-04 (cierre de sesión) — PENDIENTES abiertos de Project360

Sesión larga (02→04 oct) con Alejo Luengas como primer caso real de: personalización de marca, integración Meta Ads real, integración Fathom, CRM de Ventas (CSV, duplicados, comisiones), Proyecciones con benchmark de nicho, y sistema de accesos por rol. La plantilla de accesos y casi todos los bugs de esta tanda ya quedaron documentados arriba con su propia entrada. Esto es el **estado de lo que sigue abierto**, para no perder el hilo:

1. ~~Acceso de Omar mal guardado~~ — **CORREGIDO a mano en Supabase (04-oct).** Falta solo que Omar cierre y vuelva a abrir sesión para que se refresque.
2. ~~Migraciones 057–060~~ — **confirmado que corrieron (04-oct)** (proyecciones, fuente whatsapp/dm, acceso de miembro a leads).
3. ~~Jessica (Closer) sin invitar~~ — **RESUELTO (04-oct).** Con el fix del formulario ya desplegado, se invitó de nuevo, entró, no ve Planeación, y su Pipeline de Ventas carga con datos reales. Setter + Closer quedan verificados de punta a punta.
4. **"Olvidé mi contraseña"** (login → reset-password) construido y la URL de redirect ya está en el allowlist de Supabase — falta una prueba de punta a punta confirmada (se intentó pero se enredó con el tema de acceso de Omar).
5. **Funnel financiero — "según números propios"**: hecho el arranque por benchmark de nicho + el banner de "aplicar datos reales" (cierre/ticket desde CRM). Lo que falta, si se quiere completar la visión original: CTR/conversión de landing reales (hoy sólo Métricas los tiene vía Meta, no se jaló a Proyecciones a propósito, para no duplicar el fetch).
6. **"Campañas activas" y tendencia diaria en Métricas**: la tabla de campañas ya es real (Meta); el GRÁFICO de tendencia por día sigue simulado — declarado en el banner, no resuelto.
7. **Reporte mensual en PDF** (`reportsPdf.ts:492-493`) tiene el mismo bug que ya se arregló en la tarjeta de Clientes: usa `client.metrics.salesCount/revenueAccumulated` (guardado, nunca se recalcula) en vez de derivarlo en vivo de los leads. Anotado, no tocado.
8. **CSV de leads**: cada vez que aparece una fuente no reconocida (van "Nuevo seguidor", "DM directo"...) se agrega bajo pedido. Puede que falten más al reimportar el archivo completo de Alejo — revisar si salen más rechazos.
9. **Plantilla estándar de accesos por rol** (Setter/Closer → `management`+`ventas` editor; Admin del cliente → `pm`+`finanzas`+`ventas` editor) queda documentada arriba para aplicarse a **cualquier cliente nuevo**, no solo Alejo.
10. **Alejo Luengas y Santi ya invitados como "admin del cliente"** (04-oct) — falta confirmar que al entrar ven los 5 cajones completos (Planeación, Management, Ventas, Métricas, Finanzas). No verificado todavía en esta sesión.

---

## 2026-10-04 — Plantilla ESTÁNDAR de accesos por rol (aplica a CUALQUIER cliente nuevo)

Probada primero como prototipo HTML (Mi Espacio por rol) y aprobada por la founder antes de construirla. Queda como el reparto de acceso **por defecto** para todo cliente que se cree de aquí en adelante — no es específico de Alejo, es la plantilla.

**Los 5 cajones del cerebro de un cliente:** Planeación, Management, Ventas, Métricas, Finanzas (`src/components/brain/BrainNav.tsx` → `CAJONES`). Cada uno se mapea a departamentos (`src/config/departments.ts`):
- `pm` → Planeación (perfil) + Management (tareas, agenda, equipo, programas)
- `finanzas` → Planeación (proyección) + Métricas + Finanzas
- `ventas` → Ventas

**Reparto estándar por rol:**
- **Setter / Closer** → departamentos **`management`** (NO `pm` — ese incluye 'profile' y abre Planeación de más) + `ventas`, nivel **Editor** (necesitan mover leads y marcar tareas). Cada uno, al entrar a "Mi Espacio", ve SOLO sus leads asignados y sus tareas — no las de los demás.
- **Admin del cliente** (el dueño del negocio + su mano derecha, ej. Alejo + Santi) → los 3 departamentos (`pm`+`finanzas`+`ventas`) = acceso completo a los 5 cajones de ESA tarjeta únicamente. Incluye Finanzas (fee de agencia y costos internos) a propósito: la founder decidió que el cliente vea todo de su propia cuenta, sin excepciones. Nunca ve otros clientes ni el agregado de la agencia — eso sigue siendo exclusivo de `owner`/`direccion`.

**Dónde se configura:** Equipo → Invitar miembro (nivel de acceso + checkboxes de departamentos). Nada de esto requiere código nuevo por cliente — es 100% configuración con la infraestructura que ya existe (`ClientAccess`, `team_members.departamentos`).

**Bug cerrado en el camino (2026-10-04):** invitar fallaba con "Invalid login credentials" / "duplicate key" porque "eliminar acceso" no limpiaba `public.users`, y porque el checkbox de "Ventas" se guardaba vacío (el endpoint de invitar tenía su propia lista de departamentos, desincronizada de la real). Los dos arreglados — ver commits `126719f` y `9c2cdd5`.

---

## 2026-10-02 (noche) — Integración con Fathom para traer reuniones de Alejo (y futuros clientes sin Paralelo)

Al revisar cómo se traen reuniones/tareas por cliente, se encontró que **"Transcribir con IA" y "Subir archivo" (audio/video) en `MeetingDrawer` son botones decorativos** — solo muestran un toast "disponible próximamente", nunca se construyeron. El camino real hoy es: notas a mano, o subir un `.md`/`.docx` con "Subir resumen" (esto sí funciona), y de ahí "Extraer tareas"/"Generar ROPRE" leen ese texto.

**Hallazgo que cambió el rumbo:** consultando la API de Fathom (MCP) se confirmó que **las reuniones de Alejo ya se graban ahí** (5 encontradas desde el 9-sep, con resumen y transcripción disponibles). Fathom tiene API REST pública real (`api.fathom.ai/external/v1`, header `X-Api-Key`, se genera en Configuración de Usuario → API Access).

**Decidido con la founder:** construir una integración tipo Paralelo pero con Fathom, en vez de arreglar los botones muertos. **Diferencia clave:** Paralelo organiza por `project_id` → cliente (uno a uno); Fathom no tiene "proyectos", así que el cliente se decide **por palabra clave en el título** (lista blanca en `src/config/fathom.ts`, igual espíritu que Paralelo: lo que no calce, o calce con más de un cliente, no se importa).

**Construido** (commit `8358d4e`):
- `src/config/fathom.ts` — clientes habilitados + sus palabras clave. Alejo Luengas es el primero.
- `api/fathom/reuniones.ts` — Vercel edge function, trae de Fathom server-side (la llave nunca llega al navegador, mismo motivo que Paralelo), filtra por cliente y fecha, resuelve assignees contra el equipo real.
- `src/services/fathom.ts` + `FathomImportButton`/`FathomImportModal` — mismo patrón que Paralelo: bandeja de REVISIÓN (nada entra sin marcarse), el navegador escribe con la sesión del usuario (pasa por RLS).
- Migración `055`: amplía el CHECK de `meetings.origen` para aceptar `'fathom'` — la trampa de CHECK-vs-union-TS ya documentada, evitada a propósito esta vez.
- Botón visible en el módulo Agenda del cerebro de cada cliente habilitado.

**No se tocó** el flujo manual de notas/resumen — sigue funcionando igual para clientes sin Fathom.

**Pendiente para que funcione en producción:**
1. Correr la migración 055 (SQL editor de Supabase).
2. Generar una API key de Fathom (cuenta de la founder, Configuración → API Access) y ponerla en Vercel como `FATHOM_API_KEY`.
3. Probar con UNA reunión de Alejo antes de soltar el histórico.
4. Si funciona bien, extender a Tareas global y Agenda global (hoy solo está en la Agenda del cliente, a propósito, para probar acotado primero).

---

## 2026-10-02 (continuación) — Personalización por cliente: construida, falta correr migración 054

Retomada la sesión pausada. Construido como función genérica (no solo Alejo):

- **`ClientLogo`** (`src/components/brain/ClientLogo.tsx`): muestra `onboardingData.identity.logoUrl` si existe y carga bien; si no, cae al círculo de sigla de siempre. Reemplaza el badge fijo en `BrainHeader` y `ClientCard`.
- **Editor de Marca en `ClientInfoEditor`** (módulo Perfil → ✏️ Editar información): color de acento (picker + hex) y URL del logo, editables por la founder sin tocar la base directamente — `updateClient` hace el UPDATE a Supabase como siempre.
- **Migración `054_client_assets_bucket.sql`**: crea el bucket público `client-assets` (lectura pública, escritura solo autenticados) para alojar los logos. Probada en Postgres desechable con `storage.buckets`/`storage.objects` simulados (el dump real de producción no trae el esquema `storage`, así que se verificó la sintaxis de las policies, no contra el esquema real completo). **No corrida en producción todavía** — igual que toda migración de este proyecto, la corre la founder desde el SQL editor de Supabase.

**Pendiente para cerrar el ciclo de Alejo:**
1. Correr la migración 054 en producción.
2. Subir `Logo Alejo 2025-07-11.png` al bucket `client-assets` (vía `supabase storage cp`, ya autenticado y enlazado al proyecto).
3. Poner la URL resultante + `#E11822` en el espacio de Alejo desde el editor de Marca nuevo (ya no hace falta SQL manual para esto).

---

## 2026-10-02 (tarde) — Pilares de comunicación reales de Alejo cargados en Arquitectura de Marca

La founder trajo `Pilares_Comunicacion_Alejandro.pdf` (RPM Method, octubre 2026) — un documento de estrategia de contenido con frases textuales grabadas, fuentes citadas (Hormozi, Heras, Haynes) y líneas rojas, mucho más rico que lo que había en el cerebro de Alejo.

**Lo que había:** `aiBrainData.brandArchitecture` de Alejo traía 4 pilares genéricos generados por IA ("Metodología de élite", "Resultados en pista"…) enfocados en "coaching de alto rendimiento" — **desalineados con el negocio real**, que es ayudar a familias a volver patrocinable a su piloto, no coaching de manejo.

**Reemplazado** (campo `AIBrainData.brandArchitecture`, que ya existía con el comentario "3-5 pilares de comunicación" — encaja exacto): los 5 pilares reales con su peso editorial (Lo viví 20%, No es caridad es un negocio 30%, El que paga 25%, El paddock por dentro 15%, El camino 10%), cada uno con su mensaje núcleo, el reencuadre de→a, y su cuidado. También `voiceTone` (la tabla "voz de Alejandro": tutea, frases cortas, lenguaje de paddock) y `dos`/`donts` (qué se dice / qué no se dice + líneas rojas). La `mission` se actualizó a la promesa de marca aprobada el 14-sep: "Que la carrera de tu hijo deje de ser un gasto y empiece a ser un negocio."

**A propósito NO se tocaron** `vision` ni `values` — el documento no los define, y escribirlos habría sido inventar dato sin fuente. Quedan desalineados con el nuevo enfoque (hablan de "coaching de alto rendimiento" en vez de patrocinio) — la founder lo sabe y decide si los ajusta después.

Verificado en navegador: Planeación → sub-tab "Arquitectura de Marca" (1F) muestra los 5 pilares con su texto completo.

---

## 2026-10-02 — Alejo Luengas marcado por error como `is_agency` — mismo patrón del 15-sep con Ikigai, corregido

La founder notó que Alejo salía como "Espacio de Alejo Luengas" (botón aparte en la barra superior) en vez de tarjeta normal en Clientes. Causa: `clients.is_agency = true` en su fila — el mismo flag que causó el incidente de Ikigai el 15-sep, con el mismo efecto (no aparece en la rejilla, es candidato a colgar tareas "internas"). No se sabe cómo quedó marcado así — probablemente al darlo de alta.

**Corregido:** `update clients set is_agency = false where id = '<alejo>'`. Un solo booleano — sus leads, tareas y reuniones no se movieron. Verificado: la fila quedó en `false`, Project360 sigue siendo el único `is_agency = true` real.

**Pendiente de observar:** si vuelve a aparecer este patrón con un cliente nuevo, vale la pena revisar el flujo de alta de clientes (`OnboardingWizard`/`construirClienteDesdeFila`) para confirmar que nunca copia `is_agency` de otra fila por accidente — no se investigó la causa raíz esta vez, solo se corrigió el síntoma.

---

## 2026-10-01 — ManyChat pendiente de conectar + bug real al abrir un lead + drawer editable

**ManyChat — PENDIENTE, decisión de camino tomada.** La founder tiene una API key de ManyChat (para llamar la API de ManyChat desde afuera) pero eso es la dirección contraria a la que necesitamos: lo que hace falta es que **ManyChat llame a Project360** cuando captura un lead, no al revés. Se confirmó el camino: la acción "External Request" de ManyChat (dentro del Flow Builder, configurada por la founder) apuntando al mismo endpoint `/api/v1/leads` que ya usa el Apps Script — documentado en `integraciones/manychat-leads.md`. **No requiere código nuevo.** Queda pendiente que la founder genere una API key de Project360 (`write:leads`) y configure el Flow en ManyChat. Si el WhatsApp del cliente corre dentro de ManyChat, es el mismo flujo; si es otra herramienta (GHL/Twilio/Cloud API directa), es un conector distinto — sin confirmar todavía cuál usa cada cliente.

**Confirmado: el import CSV/Excel sí existe en el CRM** — botón "Importar" junto a "Nuevo lead" en el Pipeline, construido el 29-sep.

**Bug real encontrado al usar la app (no en pruebas automatizadas):** hacer clic en cualquier lead para abrir su drawer rompía la pantalla entera (`ErrorBoundary`, "Maximum update depth exceeded"). Causa: `LeadDrawer` seleccionaba `s.eventsForLead(lead.id)` directo de Zustand — esa función arma un array nuevo (`filter` + `sort`) en cada llamada, así que cada render producía una referencia distinta y React entraba en loop infinito. **Es el MISMO patrón de bug ya documentado el 27-sep** en el Kanban del pipeline (`.filter()` inline sin `useMemo`) — esta vez en el drawer, que se escribió la misma sesión y se saltó la regla ya aprendida. Regla reforzada: todo selector de Zustand que arme un array/objeto nuevo se envuelve en `useMemo`, sin excepción, ni siquiera en código "nuevo" de la misma sesión donde ya se aprendió la lección.

**Drawer del lead ahora editable** como pidió la founder ("que se abra como las tareas con las opciones del CRM"): nombre (en el título), teléfono, email, fuente y perfil ya se editan ahí mismo, no solo Setter/Closer/valores de cierre como antes. Verificado en navegador contra datos reales de Alejo — drawer abre sin romperse, campos editables confirmados.

---

## 2026-10-02/03 — Personalización por cliente: arranca con Alejo, pausada por contexto

La founder pidió personalizar el espacio de Alejo con su identidad de marca real — compartió la carpeta de Drive `IDENTIDAD DE MARCA` (160wPe2pvNatwOTuOLTcqcp9FchW5PT9P).

**Lo que hay en la carpeta (revisado):**
- Ficha de identidad de marca completa, con paleta exacta: **Rojo Racing #E11822**, Negro profundo #0B0B0B, Gris plomo #686868, Blanco hueso #F7F7F7; tipografía Montserrat (títulos) / Inter (cuerpo).
- `Logo Alejo 2025-07-11.png` — el logo limpio (los otros 2 archivos son mockups de ChatGPT de la ficha completa, no el logo suelto).

**Hallazgo importante: hoy la app NO tiene dónde mostrar un logo como imagen.** Cada cliente se representa con un círculo de iniciales (ej. "AL") coloreado con `client.primaryColor` — ni en el header del cerebro ni en la tarjeta de Clientes hay una zona de imagen. `onboardingData.identity.logoUrl` existe en el formulario de onboarding pero es solo un campo de texto (URL) que nunca se renderiza en ningún lado.

**Decidido con la founder:** construir esto como función genérica (cualquier cliente, no solo Alejo) — mostrar el logo real cuando exista, con el círculo de iniciales como respaldo si no hay logo. Fondo de la app se mantiene CLARO siempre (pedido explícito) — lo que cambia por cliente es el logo y el color de acento, nunca el tema.

**Pausado por límite de contexto de la sesión, sin tocar código todavía.** Lo que falta para la próxima sesión:
1. Subir `Logo Alejo 2025-07-11.png` a un lugar con URL pública y estable — no hay bucket de Storage en Supabase todavía (`supabase storage ls` no mostró ninguno), hay que crear uno.
2. Guardar esa URL en `client.onboardingData.identity.logoUrl` de Alejo.
3. Construir el render del logo (con fallback al círculo de iniciales) en el header de `ClientBrainPage` y, si da el tiempo, en `ClientCard` de la rejilla de Clientes.
4. Actualizar `client.primaryColor` de Alejo a `#E11822` (Rojo Racing) — este paso es inmediato y de bajo riesgo, ya soportado en toda la app (botones, badges, Kanban), puede hacerse primero sin esperar lo del logo.

---

## 2026-10-02 (noche) — Causa raíz de los 31 leads duplicados encontrada y corregida; base limpiada

La founder reportó "Andres neisa" repetido dos veces en el Kanban. Investigado contra producción: **31 de 64 leads de Alejo estaban duplicados** (mismo nombre + teléfono).

**Causa real:** en `apps-script-leads-sheet.gs`, el alias de columna para identificar `lead_id` seguía escrito como `'lead_id'` (con guion bajo), pero se comparaba contra la cabecera YA NORMALIZADA (`normalizar()` quita guiones) — nunca calzaban. Por eso `external_id` salía siempre vacío en cada lead importado desde el Sheet, y como `/api/v1/leads` solo es idempotente por `external_id`, cada corrida del sync volvía a crear todo de cero. Mismo tipo de bug (alias sin normalizar) también afectaba `utm_source`.

**Corregido:** alias normalizados (`leadid`, `externalid`, `utmsource`) en el script, pusheado. **Limpieza ejecutada directo en producción:** borrado el lead de prueba "Camila Restrepo" (confirmado por la founder) y los 31 pares duplicados — criterio: se quedó el más completo de cada par (más campos no vacíos: teléfono/email/banda/score/ruta/perfil), empate por el más antiguo. Verificado: 0 grupos duplicados después.

**Riesgo residual, dicho sin adornos:** los leads que sobrevivieron siguen con `external_id` vacío (nunca se hizo backfill contra el Sheet real). Si se corre `reiniciarContador` otra vez sin querer, el sync volvería a duplicarlos — por ahora, **no correr `reiniciarContador`** salvo que de verdad haga falta revisar todo el Sheet desde cero.

**Kanban:** cada columna ahora tiene scroll propio con ~10 tarjetas visibles antes de necesitar desplazarse.

**Pendiente de definir con la founder:** agregar columnas "Calificado"/"No calificado" al final del Kanban — hoy ya existe una etapa "Calificado" a mitad del embudo (`LEAD_STAGES`, fijo a propósito desde el 27-sep para comparar el embudo entre clientes), así que antes de tocarlo hay que aclarar si es: (a) mover esa etapa al final, (b) agregar dos etapas nuevas distintas, o (c) otra cosa. No se tocó sin esa aclaración.

---

## 2026-09-30/10-01 — Auto-sync del Sheet de Alejo PROBADO en vivo: 63 leads reales entraron, dos bugs propios encontrados en el camino

Instalación en vivo del Apps Script (construido la sesión anterior) con la founder, acompañada paso a paso por capturas de pantalla. Costó ~3 horas de ida y vuelta — vale la pena dejar escrito lo que realmente falló, porque el patrón se va a repetir con el próximo cliente.

**(1) Bug propio #1 — `write:leads` no existía en la pantalla de generar API key.** El scope se agregó al backend (migración 049, sesión anterior) pero nadie actualizó `ApiKeysSection.tsx` (`SCOPES`) ni `apiKeys.ts` (`SCOPE_LABELS`) — la founder generó DOS keys seguidas sin poder marcar el permiso que necesitaba, porque el checkbox ni aparecía. Mismo patrón de trampa que ya se documentó en el 043 para el CHECK de Postgres, pero esta vez en el frontend: un permiso nuevo tiene que tocar TRES sitios (`SCOPES_VALIDOS` en el backend, el CHECK en la base, y la lista del panel), y el tercero se nos olvidó. Corregido en caliente.

**(2) El verdadero cuello de botella: la autorización de Google Apps Script, no el código.** `UrlFetchApp.fetch` (el permiso de "salir a internet") nunca se concedió de verdad, aunque el manifiesto (`appsscript.json`) decía tenerlo declarado. Pasó por varias vueltas falsas antes de encontrar la causa: revisando `myaccount.google.com/permissions` se vio que el proyecto solo tenía el permiso de Hojas de Cálculo — el de `script.external_request` **nunca se había concedido**, pese a que el manifiesto lo pedía. Guardar el manifiesto no basta: hace falta que Google vuelva a mostrar la pantalla de consentimiento, y **editar un script ya autorizado no siempre la dispara sola**. La solución que funcionó: quitarle el acceso del todo desde la cuenta de Google ("Borrar todo") y volver a correr la función a mano — eso sí forzó el consentimiento completo, con el permiso nuevo incluido.

**(3) Bug propio #2 — un espacio de más tumbaba cada fila.** El `client_id` quedó con un espacio en blanco al final tras un copy-paste (`...150e '` en vez de `...150e'`), y el validador `uuid` de Zod lo rechazaba con 400 — invisible a simple vista en el editor. Encontrado leyendo `request_body` directamente del log de auditoría de la API (`api_requests`), no adivinando. El script ahora hace `.trim()` sobre `API_KEY` y `CLIENT_ID` para que un espacio de copy-paste no vuelva a tumbar nada.

**(4) Metodología que funcionó:** en cada paso se verificó contra la base real (`supabase db query --linked` sobre `leads` y `api_requests`) en vez de confiar en "Se completó la ejecución" de Apps Script, que no dice si mandó algo de verdad. Fue así como se encontró que una corrida "sin errores" en realidad había procesado CERO filas (el contador de "última fila" ya estaba al final por intentos previos fallidos) — un caso más de "silencio no es éxito".

**Resultado:** 63 leads reales de Alejo (antes 1) entraron a Ventas con nombre, banda, score y ruta — verificado fila por fila contra la base. El activador de tiempo (cada 10 min) quedó instalado; de aquí en adelante corre solo.

**Pendiente:** varios leads entraron con `fuente='otro'` en vez de `meta_ads` porque su `utm_source` no calzaba con los alias reconocidos (`ig`/`fb`/`an`) — revisar qué trae esa columna en los casos reales y ampliar el mapeo si hace falta. No es un dato perdido: es corregible desde el drawer de cada lead.

---

## 2026-09-30 (tarde) — Auto-sync del Sheet de Alejo + webhook genérico de Meta Lead Ads (migración 051 corrida en producción)

Dos piezas más sobre "de dónde salen los Leads", esta vez sin intervención manual:

**(1) Apps Script para el Sheet** (`integraciones/apps-script-leads-sheet.gs`, vive en el repo pero se instala en Google, no en Vercel): revisa el Sheet cada N minutos (activador por tiempo, ella lo configura una vez) y manda las filas nuevas a `/api/v1/leads` — el mismo endpoint que ya usaría ManyChat. Busca columnas por NOMBRE, no por posición, así que sobrevive si el Sheet cambia el orden. Genérico por diseño: cambiar de cliente es cambiar 2 constantes (`API_KEY`, `CLIENT_ID`), no código.

**(2) Webhook genérico de Meta Lead Ads** (`api/meta-leads/webhook.ts` + migración 051, tabla `meta_lead_pages`): Meta manda `page_id` + `leadgen_id`, nunca el `client_id` ni las respuestas del formulario — el mapeo página→cliente vive en una tabla nueva (sin policies RLS, solo `service_role`: guarda el Page Access Token, un secreto), y el detalle del lead se pide aparte a la Graph API. Firma `X-Hub-Signature-256` verificada con HMAC-SHA256 antes de procesar nada — sin eso, cualquiera en internet podría inventar leads. Idempotente por `leadgen_id` como `external_id`, mismo `api_lead_crear` que ya usan CSV y ManyChat.

**Estado real, dicho sin adornos:** el webhook de Meta está escrito y tipa limpio, pero **no se ha probado contra una página real** — depende de que la app de Meta tenga el permiso `leads_retrieval` aprobado (revisión que puede tardar semanas para páginas ajenas a la cuenta de desarrollador). Documentado en el propio archivo qué falta para activarlo por cliente: app de Meta, suscripción del webhook, Page Access Token, una fila en `meta_lead_pages`. No se reclama como "funcionando" — queda como "listo para conectar".

**Diseño confirmado con la founder:** ManyChat y el CSV YA eran genéricos antes de esta sesión — un cliente nuevo solo necesita una API key con scope `write:leads` y su `client_id`, cero código nuevo. Meta ahora sigue el mismo principio: el webhook no tiene nada de un cliente específico, todo vive en la tabla de mapeo.

Documentado `POST /api/v1/leads` en `API_PUBLICA.md` (sección 5.12), para que quede al lado de los demás endpoints entregables a terceros.

**Migración 051 corrida y verificada en producción** (tabla `meta_lead_pages` existe).

**Pendiente:** que la founder rellene el Apps Script con su API key + client_id y lo instale en el Sheet real; conseguir la aprobación de Meta si se decide activar ese webhook para algún cliente.

---

## 2026-09-30 — Leads trae su propia calificación: score/banda/ruta del formulario real de Alejo, migración 050 corrida en producción

La founder compartió el Sheet real que alimenta el formulario de Alejo (RPM Method): no es un formulario simple de contacto, es un embudo de calificación con ramas A/B, 5 preguntas por rama, un **score numérico**, una **banda** (parcial/rojo/rojo-aviso/amarillo/verde) y una **ruta** sugerida (sprint/sprint+/academy/method), más todos los UTM de Meta Ads y un `lead_id` propio.

**Decidido con la founder:** (1) score/banda/ruta SÍ se guardan en el Lead — no se quedan solo en el Sheet. (2) Los leads en banda roja/ELIMINADO SÍ entran al pipeline (en Nuevo, marcados), no se descartan — el filtro del formulario ya opinó, pero la decisión final la deja al equipo.

**Construido:**
- `Lead.score/banda/ruta` — texto/número **libre a propósito**, sin enum ni CHECK: cada cliente con su propio formulario de calificación trae su propia escala, y normalizarla a categorías nuestras sería inventar datos (migración 050, aditiva).
- `csvLeads.ts` ampliado para reconocer las columnas reales de este Sheet: `lead_id` (identidad preferente sobre teléfono/email — misma clave que ya usa `/api/v1/leads`), `banda`, `score`, `ruta`, `enviado` (fecha real del lead, no la de importación), y `a5`/`b5` (la última pregunta de cada rama, que en este formulario es "quién decide" — se mapea a `perfilRol`). `utm_source` infiere la fuente cuando no hay columna `fuente` explícita, y a diferencia de un valor mal escrito a mano, uno no reconocido NO rechaza la fila — cae a "otro" en silencio, porque es dato de la plataforma de ads, no algo que alguien tecleó mal.
- Kanban y drawer de Ventas muestran banda (punto de color, semáforo) y score; el drawer suma una sección "Calificación del formulario".
- `/api/v1/leads` y `api_lead_crear` también aceptan score/banda/ruta, para que ManyChat pueda mandarlos igual que el CSV.

**Trampa evitada (no cometida, detectada al escribir la migración):** `api_lead_crear` cambiaba de 8 a 11 parámetros. `create or replace function` en Postgres NO sustituye una función cuando cambia la lista de parámetros — crea una SOBRECARGA nueva y deja viva la vieja. Con las dos existiendo, una llamada con los 8 parámetros originales queda ambigua entre las dos firmas (los 3 nuevos tienen default). La migración 050 empieza con `drop function` de la firma vieja antes del `create or replace`. Verificado en producción: solo queda una función, con 11 argumentos.

**Migración 050 corrida y verificada en producción.**

**Pendiente:** la founder tiene que descargar el Sheet como CSV (Archivo → Descargar → CSV) y usar el botón "Importar" en Ventas de Alejo para traer los ~40 leads reales — no se transcribieron a mano desde la vista previa del Sheet para no arriesgar un dato mal copiado.

---

## 2026-09-29 (noche) — De dónde salen los Leads: import CSV + endpoint de ingesta para ManyChat/WhatsApp, migración 049 corrida en producción

Sobre el pendiente #1 de la sesión anterior: la founder tiene 4 fuentes hoy (Meta Lead Ads, ManyChat, WhatsApp, formulario de landing). La landing no manda webhook — alimenta un Excel/Sheet que ella ya trackea a mano para Alejo. Eso cambió el plan de "construir 4 webhooks" a dos piezas reales, ambas construidas esta sesión:

**(1) Importar leads por CSV/Excel** — mismo patrón que importar clientes (26-ago): `csvLeads.ts` (lógica pura, sin React/Supabase) + `ImportarLeadsCSVModal.tsx`, botón "Importar" junto a "Nuevo lead" en el cajón Ventas. No sincroniza (R-23): bandeja de revisión, entra solo lo marcado. Identidad de un lead en el archivo: NO es el nombre (dos leads pueden llamarse igual) — es teléfono o email normalizado; un lead ya existente con ese contacto sale en gris (R-24), uno repetido dentro del mismo archivo se rechaza. Cada fila importada agrega también su evento inicial en el viaje del lead ("Importado desde CSV"), igual que el alta manual.

**(2) Endpoint `/api/v1/leads` para ManyChat/WhatsApp** — mismo patrón que `/api/v1/tasks`: función `security definer` `api_lead_crear` (migración 049) que recibe el `agencia_id` de la API key y hace el aislamiento DENTRO de la base, idempotente por `(client_id, external_id)` para que un reintento del webhook no duplique. Nuevo scope `write:leads`, agregado en el mismo commit al CHECK de Postgres (la trampa documentada en la 043: agregarlo solo en TypeScript rompe la emisión de llaves con un error críptico). Sin GET todavía — no hay consumidor externo pedido, y construirlo "por si acaso" es la misma trampa que `fasesEmbudo`.

**Bug real encontrado probando en navegador:** `ImportarLeadsCSVModal` tenía dos `motion.div` como hijos directos de `AnimatePresence` sin `key` — React tiraba warning de "keys duplicadas". Corregido con `key="backdrop"`/`key="modal"` explícitos.

**Verificado contra producción real, no maqueta:** se subió un CSV de prueba con 2 filas (una nueva, una con el mismo nombre de un lead real existente) al cliente Alejo Luengas — la bandeja mostró "2 nuevos" correctamente y el import escribió ambos leads en Supabase de verdad. **Aviso importante: el `npm run dev` de este proyecto apunta a la base de PRODUCCIÓN, no a una copia local** — las pruebas dejaron dos leads de prueba reales ("Laura Gómez" y un "Camila Restrepo" duplicado) que se identificaron por `created_at` y se borraron con confirmación de la founder antes de cerrar la sesión, sin tocar el lead real de Camila.

**Migración 049 corrida y verificada en producción** (CHECK con `write:leads`, función `api_lead_crear` presente).

**Pendiente:** emitir la key de ManyChat desde Configuración → API (ya existe el panel, solo falta que ManyChat la use) y probar el primer lead real entrando por ese camino; Meta Lead Ads y la ruta completa de WhatsApp quedan para después, como se acordó al arrancar. Nada de esto está commiteado todavía al cerrar este bloque de la sesión.

---

## 2026-09-29 (tarde) — Dashboard de Ventas ajustado sobre feedback de la founder, verificado en navegador

Sobre lo construido el 28/29-sep (todavía sin commit): se cerró el pendiente #1 de esa sesión.

**Corrección de fondo primero:** el tipo `LeadSource` en TypeScript se había quedado en los 4 valores viejos (meta/organico/referido/otro) mientras la migración 048 ya movió la base a 7 valores nuevos (meta_ads/reel/story/carrusel/perfil/referido/otro) y agregó `perfil_rol` — el código nunca se actualizó junto con la migración. `perfil_rol` tampoco estaba mapeado en `repositories.ts`. Los dos, corregidos antes de tocar el módulo.

**`VentasModule.tsx` reestructurado:** tabs internos Pipeline/KPIs (el Kanban vive en Pipeline; KPIs es nuevo). Filtro de período (Hoy/7d/15d/30d/60d/Rango con fechas) — acota los KPIs y las gráficas por `createdAt`, pero el Kanban de Pipeline se deja SIN filtrar a propósito: es el estado vivo del pipeline, no un corte histórico. Tab KPIs: una tarjeta por Setter y por Closer (Leads/Ganados/Tasa de cierre/Cash collected), filtrable por el mismo período. El modal de alta de lead ahora pide Setter y Closer desde el inicio (antes solo se asignaban después, en el drawer).

**Verificado en navegador contra datos reales de Alejo Luengas** (no maqueta): el lead real "Camila Restrepo" aparece con fuente "Meta Ads" (confirma que la migración 048 migró bien), las tarjetas de KPI por Setter muestran a Jessica Valdés y Omar (Rayo) con sus números, el filtro Rango despliega los dos campos de fecha, y el modal de nuevo lead trae los selects de Setter/Closer poblados con el equipo real del cliente.

**Sigue sin commitear ni pushear** — la founder decide cuándo.

---

## 2026-09-28/29 — Arquitectura de 6 cajones EN CÓDIGO, cajón Ventas construido y verificado en producción, primer cliente real (Alejo Luengas) dado de alta

**Sesión larga, varios hitos de código real + migraciones corridas en producción.**

### Onboarding real: Alejo Luengas

Primer cliente dado de alta con el brief completo del founder (18 grabaciones documentadas). Regla seguida al pie: **lo marcado "NO SÉ" en el brief no se inventó** — se preguntó antes de forzar campos obligatorios (metas 3/6/12 meses, facturación actual, email/WhatsApp de Alejo). Equipo cargado en el módulo Equipo, cada persona con KPIs independientes: Omar (Rayo) y Jessica Valdés como Setters separados, Sebastian Peralta como Closer (Natalia y Paola salieron del proyecto), Marisol Ochoa como Estratega+PM+Closer ocasional, Santiago Durán como Media Buyer, Alejo como Experto.

**Corrección propia importante:** en un punto dije que el sistema solo admite una persona por rol por cliente — **era falso**, leí la tabla legada equivocada (`client_team_members`/`useTeamStore`) en vez de la real (`team_members`/`TeamMembersPanel`), que sí soporta múltiples personas por rol con KPIs propios. Corregido en el momento; queda como lección: verificar CUÁL sistema pinta la pantalla antes de describir sus límites.

### Arquitectura de 6 cajones — implementada, no solo diseñada

`BrainNav.tsx` rediseñado de 8 pestañas planas a **nivel 1 (6 cajones: Planeación, Management, Ventas, Métricas, Finanzas, Contenidos-oculto) + nivel 2 (sub-tabs contextuales)**. ROPRE sale del nav — su ruta sigue viva (usada desde Reportes) sin romper nada. Verificado en claro y oscuro sin CSS especial (reusa los tokens `html.theme-light` que ya existían). Rol **"Setter"** agregado al catálogo global de KPIs (`types/team.ts`).

### Cajón Ventas — pipeline funcional, verificado extremo a extremo en producción

Migración `047_ventas_pipeline.sql` (tablas `leads` + `lead_events` append-only) probada en local y **corrida en producción por CLI de Supabase** (el login web estaba trabado por recuperación de 2FA de GitHub — el CLI mantenía sesión propia, no dependía de eso). `VentasModule.tsx`: Kanban de 8 etapas SOP con drag-and-drop nativo, drawer "Viaje del lead", **`cash_collected` manual e independiente de las cuotas** (decisión ya tomada, no recalculado), motivo obligatorio al marcar "Perdido", asignación setter/closer. **Bug real encontrado probando contra la base real** (no aparecía con datos vacíos): un selector de Zustand con `.filter()` inline sin `useMemo` causaba loop infinito de renders — regla nueva para este proyecto: todo selector de store que arme un array/objeto nuevo debe envolverse en `useMemo`. Verificado con un lead de prueba que persistió tras recargar.

**Se evaluaron y descartaron** Twenty (AGPLv3, backend propio) y Comp AI CRM (Prisma/Postgres propio, login Google/Microsoft) como base del CRM — ambos exigían infraestructura y login separados; se construyó nativo en el Supabase existente.

### Migración 048 — corrida en producción (29-sep, sesión siguiente)

`048_leads_perfil_fuente.sql`: `fuente` pasa de meta/orgánico/referido/otro a **meta_ads/reel/story/carrusel/perfil/referido/otro**, y se agrega `perfil_rol` (texto libre — quién es el comprador; cada cliente define sus categorías, no es enum fijo). **Fallo real al correrla la primera vez, encontrado y corregido en el momento**: el orden importa — hay que **soltar la restricción vieja ANTES de remapear los datos**, porque el propio `UPDATE` a `meta_ads` viola la restricción vieja (que no conoce ese valor) si todavía está puesta. El archivo de la migración quedó corregido con el orden real que funcionó. Verificado contra el lead real "Camila Restrepo": migró de `meta` a `meta_ads` sin perderse.

### Pendiente para la próxima sesión

1. **Feedback de la founder sobre el dashboard de Ventas** (maqueta de referencia suya, sin datos reales detrás): reestructurar en tabs internos (Pipeline/KPIs), agregar tarjetas de KPI por Closer y por Setter, filtros de período (Día/7d/15d/30d/60d + fecha), y que el formulario de alta de lead pida Setter+Closer desde el inicio (hoy solo se asignan después, en el drawer).
2. **"Llamadas programadas" (agenda sincronizada con Calendly) queda deliberadamente fuera** — depende de la integración Calendly/Google Calendar del roadmap, todavía sin construir.
3. **Nada de esto está commiteado ni pusheado** — todo vive local; la base de datos ya tiene 047 y 048 corridas. Falta decidir cuándo se hace commit+push para que Vercel lo despliegue.

**Resuelto en esta sesión:** GitHub — la founder ya recuperó el acceso y regeneró los códigos de recuperación.

---

## 2026-09-24 — Campana personal, informe ROPRE rehecho, y arranca la planeación del dashboard nuevo

**7 commits de código (18-21 sep) + una sesión larga de planeación sin tocar la app (22-24 sep).**

### Código en producción

**Campana personal.** Dejó de pintar un número sin acción: ahora es tuya — tus tareas retrasadas y las de hoy, calculadas en vivo, sin "leído" que mentir (una tarea sale de la lista al completarse, no al marcarla vista). La regla de "¿esta tarea es mía?" se sacó a `useIdentidadTareas`, compartida con Tareas, para no duplicarla.

**El informe ROPRE se rehizo dos veces sobre feedback real.** Primera vuelta: quitado el tablero duplicado y los entregables ya cerrados — de "qué hay registrado" a "qué requiere acción". Segunda vuelta: objetivos primero (son el marco), resumen de la última reunión debajo (sale de `meeting.summary`, ya guardado — sin IA), ROAS e inversión en una tira de 5 celdas, y selector de periodo (semana/quincena/mes/rango). Cuando ROAS/inversión no están frescos, el informe lo dice en vez de aparentar que son de hoy.

**Bug de fondo en el motor de PDF, afectaba a los tres reportes.** Un bloque más alto que una página se colocaba igual y lo que sobraba se perdía — sin error, sin aviso. Lo vio la founder en el semanal de Ikigai: media página en blanco y riesgos cortados. La regla de paginación salió a `utils/paginarBloques.ts`, probada con 20 casos; ahí mismo apareció un segundo hueco (un bloque que cabía en la página 2 pero no en la 1, por la portada, se seguía saliendo). De paso: el semanal listaba 14 tareas diciendo "18 tareas" en la etiqueta — se contradecía a sí mismo y nadie lo notó hasta que la paginación se pudo confiar.

**Las notas subidas llegaban rotas, y el error de la IA no se podía leer.** Un `.md` de Gemini se convertía a HTML con `marked` y perdía las entidades (`&nbsp;` literal) y la estructura. Se usa el markdown tal cual ahora, con `limpiarTexto.ts` quitando además el pie de página del exportador. Y el motivo real de un fallo de Anthropic pasaba por tres recortes (300/200/80 caracteres) antes de llegar a pantalla — desenvueltos, y los tres casos que NO son bug de código (sin saldo, llave inválida, texto muy largo) se traducen a español con dónde arreglarlos.

### La planeación del dashboard nuevo (sin código todavía)

La founder pidió reorganizar el Dashboard en departamentos según lo que ya usa en otra herramienta (Ikigai Dashboard Comercial). Se armó la arquitectura completa a punta de maquetas HTML, iterando sobre feedback visual — **la primera versión inventó un sistema de diseño propio, corregido de inmediato**: todo se reconstruyó calcando los tokens y componentes reales de la app (colores de `index.css`/`tailwind.config.js`, `Button`, `ClientCard`, sidebar y header reales; los números en DM Sans y no en Syne, que al peso 800 se ve más grande de lo que es en píxeles).

**Decidido:**
- **Seis cajones** en el cerebro del cliente: Planeación (Perfil, Proyección), Management (Tareas, Agenda, Equipo, **+ Programas**, que se muda ahí), **Ventas** (nuevo: Setter, Agenda de Ventas, CRM), Métricas (Pauta + Orgánico + Embudo), **Finanzas** (nuevo), Contenidos (ya existe, apagado desde la beta).
- **ROPRE sale del menú del cerebro** — queda solo como Informe ROPRE dentro de Reportes, que ya está construido.
- **La Agenda se queda única, con filtro** Todas/Internas/Ventas — se descartó la opción de duplicarla en dos secciones.
- **Finanzas: la fuente de datos se elige por cliente** (Excel/CSV, .md, Stripe, Hotmart, otra) — un cliente manda Excel, otro tiene Stripe.
- **Facturación → link de Stripe. Agenda semanal → Calendly.** Leads: sigue sin fuente definida.
- **Métricas Orgánico va por API oficial de cada red** (Meta Graph API, YouTube Data API, TikTok for Business), no a mano — aceptando que Meta/YouTube pueden tardar semanas en aprobar el acceso. Mientras tanto queda "sin conectar", igual que Pauta hoy (que también sigue en modo demo, sin OAuth real).
- **Embudo visual nuevo dentro de Métricas**, con clic por fuente (Meta/Google/TikTok/Orgánico) que cambia Inversión/Revenue/ROAS/CPA y los 5 pasos del embudo — prototipado con clic funcional de verdad, a falta de las curvas tipo Sankey de la referencia que mandó.
- **El portal del cliente final sigue sin dashboard propio** — hoy es solo un link público de un embudo, sin login. Construirlo es un producto aparte, no una pestaña más.
- Los departamentos de acceso (hoy 3: PM/Finanzas/Content) van a tener que ampliarse para los seis cajones nuevos.

**Pendiente de esta sesión:** de dónde salen los Leads; afinar el Embudo (curvas) o seguir con Finanzas; ampliar los departamentos de acceso; decidir qué distingue "Agenda de Ventas" de la Agenda interna a nivel de dato (ya resuelto en diseño: es el mismo componente con el filtro puesto).

---

## 2026-09-15 — Ikigai deja de ser la agencia y pasa a ser un cliente: el espacio interno se separa

**2 commits. Migración 046 corrida y verificada.** Empezó como "no me salen los clientes" y terminó en una decisión de modelo.

### El síntoma y la causa
El Dashboard decía "1 clientes activos de 1 totales" con 3 clientes en la base. Causa: **`clients.is_agency` hace DOS trabajos a la vez** — marca "este es mi espacio interno" (donde cuelgan las tareas personales, porque `tasks.client_id` es obligatorio) y "no lo muestres en la lista de clientes". Con Ikigai y David Guerrero marcados, quedaba una sola card.

David Guerrero estaba marcado **por error**. Ikigai lo estaba **con razón, en su momento**: cuando la app se llamaba "Ikigai Agencia", Ikigai *era* la agencia que operaba. El 26-ago la app volvió a ser Project360 y **el modelo cambió pero el dato no**. Ese desfase es el mismo patrón del 18-ago: no un bug técnico, sino distancia entre lo que la app supone y lo que la founder espera.

### La decisión
Ikigai pasa a ser un cliente como Andrea, y **la agencia se queda con un espacio interno propio y vacío** (migración 046). No se desmarcó Ikigai a secas porque de esa casilla colgaban tres cosas:

1. **El reporte de la Daily** — `esDaily()` exigía `isAgency`.
2. **"🔒 Personal" de Mi Espacio** — `mi_espacio_personal()` devuelve el cliente con `is_agency`; sin ninguno, devuelve null y la opción desaparece para todo el equipo.
3. **El filtro Cliente/Internas** de la Agenda.

El (3) **se resuelve solo y no era una rotura**: si Ikigai es cliente, sus dailies son reuniones de cliente. Reclasificarlas es lo correcto.

El (1) sí era una rotura, y **de las mudas**: el reporte genérico le pide todo a la IA a partir de las NOTAS, y una daily de Paralelo no tiene notas sino resumen — sale un titular, un párrafo y una página en blanco. Es literalmente el bug del 20-ago. La condición pasa a `CLIENTES_CON_DAILY`, declarado **por nombre** como `PARALELO_PROYECTOS` y por el mismo motivo (los UUID cambian entre local y producción).

### Lo que la migración NO hace, a propósito
No mueve las reuniones de Ikigai (son suyas). Y **no toca las tareas privadas de David Guerrero**: una tarea privada en un cliente normal es legítima, y desde SQL no hay forma de saber si la escribió "Personal" mientras estuvo mal marcado. La migración las cuenta para que las mire una persona. **Cuando no se puede distinguir, se cuenta y se pregunta; no se decide en silencio.**

### Dos fallos propios, los dos encontrados con la prueba de datos
`on conflict do nothing` **no hacía nada** —no hay restricción única en `name`— así que la segunda corrida creaba un SEGUNDO espacio interno: la migración no era idempotente. Y el respaldo iba *después* de crear el espacio, así que se guardaba a sí mismo y deshacer lo habría dejado marcado como agencia.

Ninguno de los dos se ve leyendo el SQL. Salieron al ejecutarlo contra filas que reproducían el estado real. **Es la tercera vez esta semana que el fallo aparece al medir y no al deducir.**

### Antes, dos bugs viejos de la misma captura
**El menú "Reportes PDF" llevaba meses recortado.** `BrainHeader` tenía `overflow-hidden`, que corta lo que se despliega fuera del borde: solo se veía la primera opción, así que el mensual, el de reunión y el de lanzamiento eran inalcanzables **sin que nada fallara**. Por eso nadie lo reportó.

**Y `ClientsPage` enlazaba el espacio de agencia con `find`**, o sea solo el primero. Con dos marcados, el segundo desaparecía de la rejilla, del sidebar y del enlace a la vez: inalcanzable salvo escribiendo la URL. Pasó de verdad — David Guerrero dejó fuera a Ikigai.

**Los dos los encontró la founder usando la app, no el CI ni las 172 pruebas.**

---

## 2026-09-09 — Los nombres duplicados: una sola tabla de apodos, y dos bugs que solo vio la prueba

**4 commits. Migraciones 044 y 045 corridas por la founder.** El filtro "Todas las personas" mostraba **37 entradas para 17 personas**: la misma gente con hasta tres etiquetas — "Cisco" y "Francisco Otalvaro", "Jona"/"Jhonatan"/"Jonathan", "Lucho"/"Luisa"/"Luis David Flores".

### El diagnóstico: no era un bug, eran dos trabajos que nadie había separado
Los alias YA existían desde el 14-ago y funcionaban. Pero se aplicaban **solo al importar**, así que arreglaban lo que entraba de ahí en adelante y dejaban intacto todo lo anterior. **Una tabla de equivalencias y una limpieza de datos son dos encargos distintos**, y hacer solo el primero da la sensación de haberlo resuelto.

### La tabla se muda a JSON, y el motivo no es técnico
`src/config/aliasPersonas.json` la lee **el código** (para lo que entra) y **el generador de la migración** (para lo que ya está). En TypeScript habrían sido dos listas, y la que se toca poco se queda atrás — el fallo de los dos traductores del 11-ago, y el mismo principio por el que el diccionario del export sale de la misma definición que los datos. La migración **se genera**, no se escribe a mano.

### Dos bugs que encontró la prueba, no la lectura del código
**(1) La regla de desconocidos era demasiado ancha.** La primera versión mandaba a la bandeja de Marisol *todo* lo que no reconocía, y se llevó por delante a "Tony" y al cliente "David Guerrero". La lectura correcta de lo que pidió la founder —*"algunos sin saber con el nombre de speaker u otro"*— eran **etiquetas**, no nombres: `Speaker A`, los grupos y el vacío. Un nombre real desconocido se sigue dejando VISIBLE, porque así se corrige en dos clics; escondido en la bandeja de otro, no lo corrige nadie.

**(2) Un bug del 14-ago que nunca había saltado.** La regla de "primer nombre único" no miraba cuántas palabras traía el nombre: **"David Guerrero" (cliente) se convertía en "David Castaño" (del equipo)** por compartir el primer nombre. Ahora solo aplica a nombres de UNA palabra — con dos, el apellido es información y contradecirla es inventar.

Los dos salieron porque **la lista de casos de la prueba es la real del desplegable**, no un ejemplo inventado. Es la diferencia entre una prueba que confirma lo que ya creías y una que te contradice.

### Speaker A: la regla vieja se mantiene, la conclusión cambia
Sigue sin mapearse a una persona — no es un apodo, es el orden en que la diarización oyó las voces y se reparte de nuevo en cada reunión. La propia founder lo confirmó: *"Speaker A puede ser media buyer o David Castaño"*. Lo que cambia es a dónde va: antes se quedaba en crudo y **nadie lo reclamaba nunca**; ahora cae en quien reparte el trabajo. **No es adivinar: es que lo que no es de nadie tenga dueño de triaje.**

### La 044 no se reescribió, aunque la corrección fuera de una línea
La founder corrigió el mismo día ("Tony es Antonio Vital") **después** de haber corrido la 044. Se hizo una **045** que vuelve a aplicar la tabla entera (lo ya normalizado no casa con ningún alias, así que en la práctica solo mueve a Tony). **Editar una migración ya aplicada deja a quien la lea sin saber qué se ejecutó de verdad** — el log de migraciones es el historial de lo que se le hizo a la base, no un archivo de configuración.

Por el mismo motivo, la tabla deja escrito que **Tony está ahí por corrección y no por olvido**, y que David / David Guerrero se conservan a propósito. Es la única forma de distinguir "se decidió así" de "se nos pasó" — que es literalmente el problema que se está arrastrando con `fasesEmbudo`.

### Verificación
No bastó con `probar_migracion.sh` (comprueba que el SQL no revienta, contra un esquema vacío): **aquí lo que podía fallar era la lógica**, así que se probó **con filas** y **encima de la 044 ya aplicada**, que es el estado real. Resultado con los 31 nombres reales: 31 distintos → 16, la ñ y las mayúsculas no estorban, el jsonb dentro de las reuniones se reescribe (si no, el nombre viejo reaparece al abrirla), una reunión con `[]` no rompe la consulta, hay respaldo y la segunda pasada no cambia nada. 58 comprobaciones en `npm run test:alias`, ya en el CI. **CI verde y desplegado.**

**Pendiente menor:** la founder escribió "Antonio Vitale" y en la app está "Antonio Vital". Se usó el de la app para no crear un duplicado nuevo; si la grafía correcta lleva la e, se arregla en Equipo y no en la tabla.

---

## 2026-09-07 — Se cierran dos decisiones arrastradas: ROPRE se queda (con salida propia), `fasesEmbudo` se aplaza

Sesión sin features nuevas a propósito: la founder pidió cerrar decisiones pendientes en vez de construir. Las dos que llevaban semanas en la lista se decidieron **midiendo el costo, no opinando**.

### ROPRE NO se retira — y la pregunta estaba mal planteada
Se midió la superficie real antes de decidir: **~47 archivos de `src` y `api`, ~300 referencias**, y cinco puntos de contrato externo que no se revierten con un borrado:

1. El endpoint público `/api/v1/ropre` y su scope de API key — **ya entregado a Paralelo**.
2. La RPC `api_ropre_listar` en Supabase (migración 043).
3. El `formatoVersion: 1` del paquete de traspaso, que incluye la tabla `ropre`.
4. El volcado de riesgos y bloqueos de las reuniones importadas de Paralelo (`volcarAlRopre`), que **hoy no tiene otro destino**: retirarlo sin sustituto significa que esos riesgos se pierden en la importación.
5. El `origin.type = 'ropre'` y el tag `ropre` **ya persistidos en datos reales** de tareas.

No es un módulo muerto como lo fue el constructor visual de embudos, que se retiró el 25-ago sin coste. La comparación es instructiva: aquel **decía "guardado" y no escribía en ningún sitio**; este es el destino de un pipeline vivo.

**Lo que la founder pidió en su lugar** no era menos código sino más salida: *"dejarlo pero como un informe que se envía desde la agenda"*. Es decir, el problema nunca fue que ROPRE existiera — era que no producía nada que se pudiera mandar. Se construyó eso.

### `fasesEmbudo` sin `embudos`: se aplaza, y en el camino se descubrió que ya estaba roto
La pregunta del 26-ago no era hipotética. El preset por defecto de `ExportarPortafolioModal.tsx` incluye `fasesEmbudo` pero **no** `embudos`, y `traspasoDatos.ts` declara `DEPENDENCIAS = { fasesEmbudo: 'embudos' }` — así que **cada paquete que ha salido dispara el aviso de "referencias sin destino"**. El aviso funcionó exactamente como se diseñó; lo que faltaba era que alguien lo leyera.

La founder decide **no tocarlo ahora**: a Ikigai se le pasará "lo que le corresponde para gestionar el proyecto" y el traspaso sigue en pie, acotado. **Queda registrado como deuda conocida, no como olvido** — que es la diferencia entre un pendiente y una sorpresa.

### Lo construido: informe ROPRE en PDF, descargable y enviable

**Un motor, no dos.** `src/services/ropreReport.ts` reusa `composeReport` de `htmlReport.ts` (el mismo A4 paginado del semanal y del de reunión) y descarga por la única `descargarArchivo`. No se modificó ni una línea de `htmlReport.ts`: tocarlo es el riesgo de romper el semanal y el de reunión a la vez. Los estilos se copian localmente, que es lo que ya hacían `meetingStyles` y `meetingReportEditorial`.

**Hallazgo del camino:** había **dos** rutas de PDF de reunión coexistiendo y la del drawer no era la del menú de reportes — `ReportsMenu` llama `exportMeetingReportHTML` (solo descarga) y `MeetingDrawer` llama `downloadMeetingReportPdf` de `meetingReportEditorial.ts`. Solo la segunda sabe producir base64, así que es la única que puede enviarse por correo. **Fue el molde**; la primera no habría servido.

**Sin IA, a propósito.** El ROPRE ya es una estructura curada a mano — a diferencia de las notas de reunión, que sí hay que sintetizar. Todo lo que sale está **contado** desde los items. Así el informe no depende de que Claude responda, no añade latencia, y no hay nada que marcar como "lectura" (R-46). Si algún día se le quiere añadir interpretación, va como bloque extra al final, nunca sustituyendo lo contado.

**Un solo endpoint de correo.** `api/enviar-reporte-reunion.ts` no validaba nada específico de reunión y ya autorizaba por `clientId`, así que se reusa entero. Se le añadió un `kind` opcional que **solo** cambia el asunto y el texto del cuerpo, **con default `'meeting'`**: una llamada sin `kind` —front viejo, o deploy sin propagar— se comporta exactamente como antes. El correo del ROPRE llega igual aunque el backend no haya subido todavía.

**Dos redes de seguridad contra bugs ya conocidos de esta casa:**
- `buildRopreReport` **vuelve a filtrar por `clientId`** aunque quien llama ya lo haya hecho — para que no se cuele el ROPRE de otro cliente.
- Los items se leen con `useRopreStore.getState()` en el momento del clic, **no con un selector**: un selector que filtra crea array nuevo por render → bucle infinito → pantalla en blanco, que es el bug que `ReportsMenu.tsx` ya documenta en un comentario.
- Y **fallback anti-página-en-blanco**: un cliente sin ningún item produce una página con la nota, nunca un PDF vacío. El "PDF en blanco" ya fue un fallo real el 20-ago.

**Dónde se pide.** En el cerebro del cliente, "Informe ROPRE" entra en el menú de Reportes PDF. En la agenda, el pie del drawer **no crece**: "PDF" y "Enviar al equipo" pasan a ser menús de dos entradas (reunión / ROPRE), reusando el patrón de submenú que ya existía. El selector de destinatarios es el mismo, y **se le quitó la comprobación de "hay notas" cuando lo que se envía es el ROPRE** — el ROPRE tiene su propia fuente y no depende de que la reunión tenga notas.

### Estado de la verificación
Typecheck y build limpios, lint sin errores nuevos (62 avisos, los mismos de antes), 114/114 pruebas de API pasando. **Lo que falta es lo que solo se puede hacer desde el navegador de la founder** (R-45: no está hecho hasta que sobrevive y llega): abrir el PDF generado, comprobar que un cliente sin ROPRE da la página con la nota, medir el peso antes de enviar, recibir el correo, y **la regresión obligatoria** de que el semanal y los dos reportes de reunión siguen idénticos. Se deja explícito porque un PDF que compila no es un PDF que se abre.

---

## 2026-08-26 — Los datos salen de la app: importar clientes y entregar el portafolio a un tercero

**3 commits en `main`, sin migraciones.** La app deja de ser un sitio del que solo se entra: ahora los datos pueden salir, y salir con documentación.

### El encargo real tardó tres intentos en aparecer, y la culpa es del método
La sesión empezó con "sigue con CSV" y terminó tres entregas después. Se construyó **importar** clientes cuando lo que hacía falta era **exportar**; luego un **Excel bonito** cuando lo que hacía falta era un **paquete técnico**. La founder lo dijo con la frase que ordenó todo: *"cómo le paso esto a Ikigai para que ellos pongan en su servidor, no hay nada, solo una tabla sencilla"*.

**La lección, que vale más que el código:** se preguntó *qué formato* cuando la pregunta era *quién lo recibe y qué hace con él*. El formato es una consecuencia; el destinatario es el dato. Un Excel legible y un JSON con ids son el mismo contenido y encargos opuestos, y ninguno de los dos sirve a medias para el otro.

### Lo que se construyó
**Importar clientes desde CSV** (`/clientes` → Importar CSV). Bandeja de revisión, no botón de sincronizar (R-23): entra lo que una persona marca. Idempotente por nombre normalizado (R-44) — lo que ya existe sale en gris (R-24), y también se detecta el repetido dentro del mismo archivo. **Un valor que no se reconoce rechaza la fila con su motivo en vez de caer al defecto**: un estado "inventado" convertido en "onboarding" en silencio es un cliente mal clasificado que nadie revisa. El cliente importado entra sin cerebro de IA — rellenárselo sería el fallo que ya puso en producción una ficha con un rol inexistente.

**Exportar, con dos propósitos detrás de un botón.** "Para leer" (Excel de una hoja por tabla, o CSV) y "para cargar en otro sistema" (zip con JSON + `LEEME.md`). Son dos encargos y no un mismo archivo con otro nombre.

### Las decisiones que sostienen el traspaso
**El diccionario y los datos salen de la misma definición.** Si fueran dos listas, el día que alguien añada un campo actualizará una y no la otra, y el documento empezará a mentir — peor que no tenerlo, porque nadie duda de un documento.

**El paquete dice lo que NO lleva**: cuántas filas privadas se excluyeron, si el contenido de las reuniones va o no, y qué tablas se dejaron fuera. Un archivo incompleto que calla su hueco se lee como "esta agencia no usa embudos".

**Acordado con Ikigai qué tablas van**: clientes, tareas, reuniones, entregables, equipo, asignaciones, ROPRE y fasesEmbudo. Fuera `programas`, `embudos`, `contenido` y `proyecciones` — su servidor base ya los gestiona. **Se dejó como casillas y no fijo en el código**: el siguiente envío puede ser a otro sitio. La app avisa en amarillo cuando la selección rompe una referencia (hoy: `fasesEmbudo` sin `embudos`).

**El LEEME avisa de cuatro trampas que solo se saben trabajando estos datos**: `assignedTo` puede ser un slug de rol y no una persona; `isDelayed` y `clientes.metrics` están guardados y no siempre al día; `externalId` es la clave anti-duplicados de lo que vino de Paralelo. Sin eso, quien importe las descubre a mitad de camino.

**Privacidad sin interruptor**: no sale ninguna fila privada ni las marcas que la señalan. De las reuniones sale la agenda; transcripciones, notas y resúmenes solo con casilla explícita, apagada por defecto. Es la misma línea que ya traza la API pública.

### Tres fallos propios, y ninguno era del código que se estaba escribiendo
**(1) Cuatro maneras de descargar un archivo, y solo una correcta.** La exportación no bajaba nada: el enlace debe estar DENTRO del documento al hacer clic, y `revokeObjectURL` no puede llamarse en el mismo instante. Al unificarlo en `descargarArchivo` salió que **el PDF de la Daily tenía el mismo fallo y ya estaba en producción**. Es otra vez el patrón de los dos traductores de fila: dos maneras de hacer lo mismo, y la que se usa poco se queda atrás.

**(2) Chrome bloquea la segunda descarga automática de una página.** Bajaba el JSON y el `LEEME.md` —la mitad del entregable— se perdía sin error ni aviso. No se pelea con el navegador: **un envío es un archivo**, todo en zip. El CSV de varias tablas también. `fflate` pasa a dependencia declarada: ya estaba instalado por dentro de `xlsx`, y usar algo que llegó de rebote se rompe el día que xlsx cambie de tripas.

**(3) Los entregables se leían con una consulta propia** que se traga los errores y devuelve lista vacía — así que el aviso de fallo no podía saltar nunca y una consulta rota se habría leído como "no hay entregables". Ahora salen del store que hidrata el bootstrap, la misma fuente que ven las otras tres pantallas. El bootstrap además ya cuenta los entregables en su log: era justo el dato que faltaba para poder distinguirlo.

### Lo que costó horas y no debería repetirse
Se le dio a la founder el navegador de automatización (Playwright) para probar. Ese Chrome **se queda las descargas en una carpeta del proyecto**, así que durante tres rondas "no baja nada" mientras los archivos se generaban perfectamente. Se resolvió **midiendo** —leyendo los eventos de descarga del propio navegador— y no deduciendo. **Para probar en el navegador, el navegador es el suyo.**

### Verificado contra datos reales
El export dice 71 + 0 + 2 = **73 tareas pendientes**; la pantalla dice 73. De las 265 tareas cargadas salieron 254: las 11 privadas se quedaron fuera. El Excel se abrió y tiene sus 4 hojas; el zip se abre con `unzip` dentro de la propia prueba.

**120 pruebas nuevas** (`npm run test:csv`, en el CI), la mitad dedicadas a que la privacidad no se escape al añadir una columna.

### Pendientes
- **El WhatsApp de David Guerrero dice "Colombia"** en su ficha — está mal en el dato, no en el export. Si se envía hoy, va con el error.
- **Decidir si `fasesEmbudo` va sin `embudos`**. Hoy da igual (las dos en 0 filas); si empiezan a usarse, Ikigai recibiría fases huérfanas.
- **Enviar el paquete a Ikigai** y ver qué pregunta su equipo: lo que pregunten es lo que le falta al `LEEME.md`.
- Sigue abierto todo lo del 25: token de Telegram, que entren Lorenzo y Juan Camilo, que Paralelo dispare, plantillas 2-5, y si se retira ROPRE.

---

## 2026-08-19 → 25 — El auditor empieza a encontrar lo que nosotros no veíamos

**~20 commits en `main`, migraciones 040, 041 y 042 corridas.** La semana en que se dejó de construir features para sistematizar, y en que la app pasó a revisarse sola.

### El cambio de rumbo, y por qué
La founder paró el avance: *"sigue sin funcionar como quiero la app"*. El hallazgo que le dio forma a lo que vino después: **ninguno de los bugs caros era un fallo técnico** — el código compilaba, el CI estaba verde y las 69 pruebas pasaban. Eran desacuerdos entre lo que la app hacía y lo que se esperaba de ella. Un auditor de código no los encuentra: **primero había que escribir las reglas**.

Nace `REGLAS_del_Sistema.md`: **48 reglas** sobre cómo DEBE comportarse la app, cada una con su porqué, el incidente que la originó y su estado (verificada · sin comprobar · se incumple · por confirmar). Las ❌ son la lista de huecos abiertos. Es el contrato contra el que audita el agente.

### El auditor corre en el computador, no en la nube
Se intentó como rutina en la nube y **se descartó por una razón organizativa, no técnica**: la cuenta de Claude es compartida con la agencia y el repositorio es personal. Conectarlos exigía rehacer la conexión de GitHub de la cuenta compartida, y eso le quita el acceso a quien más la use. **La founder lo paró y tenía razón** — no vale un informe diario.

Corre con `launchd` a las 7:00 cada mañana (`pruebas/auditar.sh`). Modo **solo reporta**. Prioridad fijada por la founder: pérdida de datos > permisos > incumple una regla > features a medias > deuda. Lo que se pierde: si el equipo está apagado a esa hora, esa corrida se salta. La primera corrida real murió porque **el computador se durmió a mitad** — se arregló con `caffeinate`, y falló ruidosamente en vez de subir un commit vacío.

### Lo que encontró el auditor, y nadie más
**Dos módulos decían "guardado" y no escribían en ningún sitio.** Planeación (embudos) y el Agente SOP: ni repositorio, ni tabla, ni `localStorage`. Crear un embudo sacaba un toast de éxito y al recargar no quedaba nada; el SOP perdía las 25 respuestas de un prospecto. Llevaba meses así. **No lo vio el typecheck, ni el linter, ni las 69 pruebas, ni Claude en dos semanas mirando el código.** Y devolvió la pregunta correcta, que no era técnica: *¿los usan?* La founder dijo que no → **se retiraron**, con sus stores y sus tipos. Regla R-48.

**De 30 rutas de escritura, solo UNA deshacía su cambio al fallar.** El aviso puesto el 19 solo mitigaba: la fila fantasma seguía en pantalla, indistinguible de las reales. Cerrado el 25 con `escrituraOptimista.ts` — revertir quirúrgico, no restaurar la lista entera, porque en los segundos que tarda el fallo el usuario puede haber editado otra fila. **Cuatro rutas NO revierten a propósito**: son autoguardados de algo que se está escribiendo, y borrarle a alguien lo que acaba de teclear arreglaría la mentira destruyendo el trabajo.

### Los duplicados de equipo: el mismo bug en tres capas
Invitar a un miembro lo duplicaba. Se arregló tres veces seguidas, y **cada arreglo destapó la siguiente capa**: la ficha (insert a ciegas), el login (se rendía si el correo ya existía) y la lista en memoria (push sin mirar). De ahí la **R-44: una operación repetible es idempotente en TODAS sus capas**. El error de fondo era conceptual — **invitar a alguien es darle acceso, no darlo de alta**.

Se limpiaron 19 fichas a 13 con un script probado contra Postgres real y los datos exactos de producción: **ningún KPI perdido**, y las fechas de alta reales recuperadas.

### Rol de dirección (migración 040)
Tercer nivel entre dueña y miembro. Lorenzo (CEO) y Juan Camilo (CTO) ven todo lo del equipo de su agencia, **no administran** (Configuración no existe como ruta para ellos) y **no ven lo privado**. Verificado en Postgres local: ve los clientes de su agencia, no ve una tarea privada ajena, no cruza a otra agencia. **Falta que entren en producción.**

### Paralelo: de cotización a configuración
**Confirmaron que su plataforma manda webhooks**, así que su lado deja de ser desarrollo. Se les entregó un webhook que **solo anota** (migración 041): interpretar su formato ahora sería adivinar. Probado de punta a punta. **Esperando que disparen el primer evento.**

Se habilitaron Andrea Torres e Ikigai Agencia. El aviso en amarillo que se puso el 18 **cazó su primer caso real**: el cliente estaba declarado como "Ikigai" y se llama "Ikigai Agencia".

### Reportes: plantilla 1 de 5, verificada
El reporte de la Daily. **La decisión de diseño: se parte en dos mitades con reglas distintas** — los HECHOS se cuentan desde la base y la IA no los toca; la LECTURA la interpreta la IA con prohibición de rellenar. **La founder verificó que el pulso acierta y las prioridades son las que se dijeron.**

Tres fallos propios, **todos de entrega y no de contenido**: se perdía al recargar, el PDF salía en blanco y no se enviaba. De ahí la **R-45: una función no está hecha hasta que su resultado sobrevive y llega a quien tiene que leerlo.**

### Reglas nuevas de la semana
R-39 a R-48. Las que más se van a usar: **R-44** (idempotente en todas sus capas), **R-45** (no está hecho hasta que llega), **R-47** (todo lo que existe tiene una puerta) y **R-48** (un store que no habla con la base no puede decir "guardado").

### Pendientes
- **Token de Telegram y correos** → el informe llega al repo pero no al móvil.
- **Que Lorenzo o Juan Camilo entren** → cierra el rol de dirección.
- **Que Paralelo dispare** el webhook.
- Tres detalles de dirección del informe del 21: puede pulsar botones que la base le rechaza, ve módulos vacíos sin explicación, y "Copiar equipo" canta el éxito antes de guardar.
- **Plantillas 2 a 5** de reportes. La 2 sigue bloqueada por una pregunta sin responder: de dónde salen las métricas por cliente.
- Decidir si se retira ROPRE.

---

## 2026-08-18 — Paralelo ampliado a 3 proyectos, "interna" corregido, y decisión de parar a sistematizar

**5 commits en `main`.** Sesión de uso real que terminó en un cambio de rumbo.

### Habilitados Andrea Torres e Ikigai
La founder no veía en la bandeja reuniones que sí tiene en Paralelo. **Medido: agosto tiene 6 reuniones** — 2 de David (ya salían, no faltaba ninguna), 1 de Andrea y 3 de Ikigai. No era un fallo: los otros dos proyectos seguían comentados. Ikigai entra con `tipoReunion: 'management'` por ser interna. **Su histórico de 117 reuniones NO entra**: el arranque del 1-ago lo acota a 3. Floppy sigue fuera.

Un proyecto declarado cuyo cliente no exista en Project360 ahora **aparece en amarillo con el motivo** en vez de filtrarse en silencio — un nombre mal escrito se convertía en "la app no trae las reuniones de X", un misterio en vez de un error. **Funcionó a la primera: "Ikigai" salió en amarillo**, así que el cliente está guardado con otro nombre. Pendiente saber cuál exactamente.

### Corregido: "interna" se decidía por el TIPO de reunión
`INTERNAL_TYPES` marcaba internas las de tipo `general` y `management`. Las importadas de Paralelo entran como `general`, así que **una reunión de cliente salía con badge "🏛️ Interna" y filtrar por "De cliente" la escondía**. Ahora **una reunión es interna si pertenece al cliente-agencia (`isAgency`)**: el tipo describe de qué va, el cliente dice de quién es. Era lo que la documentación decía desde julio ("las internas viven en el cliente Ikigai"); el tipo se había quedado haciendo de sustituto y lo hacía mal.

El filtro Cliente/Internas **se mueve** de la agenda del cliente a la Agenda Global: dentro del cerebro de David todas las reuniones son de David, allí no discriminaba nada. Por defecto no filtra.

### El modelo global ↔ cliente, confirmado
La founder lo enunció y se verificó contra el código: **una sola fila, dos vistas**. La global (sidebar) muestra todo —Ikigai incluido—, la del cliente filtra por `client_id`. No hay copia ni sincronización. Ya funcionaba así.

### 🔴 HUECO ABIERTO: no existe el rol de dirección
La founder quiere que la vista global la vean ella, **Lorenzo (CEO) y Juan Camilo Correa (CTO)**. Hoy eso **no existe**: `AppRouter` manda a cualquier usuario con rol `member` a `/mi-espacio`, sin acceso a `/tareas` ni `/agenda-global`. Solo hay dos niveles —dueña y miembro— y falta el de en medio. **Bloqueado esperando un dato: si Lorenzo y Juan Camilo ya están dados de alta como usuarios** (si sí, hay que migrarlos; si no, se crean con el rol nuevo). **Confirmado que lo privado sigue privado** también para dirección.

### CAMBIO DE RUMBO: parar y sistematizar
La founder detiene el avance de features: *"sigue sin funcionar como quiero la app"*. Pide un **agente que revise en loop** buscando huecos y fallas, proponga soluciones y dé retroalimentación continua.

**El hallazgo que da forma a esa petición:** ninguno de los bugs de estos días fue un fallo técnico. El código compilaba, el CI estaba verde y las 69 pruebas pasaban. Eran **desajustes entre lo que la app hace y lo que se espera que haga** — "interna" por tipo, la bandeja mostrando un nombre y guardando otro, el arranque y la ventana pisándose. **Un auditor de código no los encuentra: hay que escribir primero las reglas del sistema.** Por eso el paso 0 no es el agente, es el documento de reglas.

### Pendientes
- Nombre exacto del cliente Ikigai en Project360.
- ¿Lorenzo y Juan Camilo existen ya como usuarios? → rol de dirección.
- Importar y verificar Andrea (6-ago) y las 3 de Ikigai.
- Respuesta de Paralelo: llave de servicio, webhooks, cotización.
- 48 tareas vencidas y 2 duplicadas en la vista global.

---

## 2026-08-14 — Importación de reuniones de Paralelo: verificada en producción y ampliada al reporte completo

**7 commits en `main`, migración 039 corrida.** Project360 pasa a LEER las reuniones de Paralelo (Meetico) y traerlas como propias, con sus tareas. Cierra el lado nuestro; el de ellos —que consuman nuestra API— sigue pendiente de cotización.

### Verificado de punta a punta
La founder importó la reunión real del 5-ago: **las 12 tareas entraron y aguantaron la recarga**. Ese punto había fallado cinco veces la semana pasada, así que se probó a propósito antes de dar nada por bueno.

### Decisiones que quedaron en el código

- **La fecha de entrega sale de NUESTRO SLA, no del `dueDate` de Paralelo.** El suyo no es una fecha, es prosa: "ASAP", "cuando vuelva Bala", "antes de la fase evergreen". Interpretarlo sería inventar, y una fecha inventada mete tareas falsas en "atrasadas" y ensucia el cumplimiento del equipo. El texto original sí viaja, a la descripción.
- **Un responsable que no se reconoce se deja en texto crudo.** Una tarea con nombre raro se corrige en dos clics porque salta a la vista; una asignada en silencio a quien no es no la corrige nadie.
- **NO se agrega "Speaker A" → Jhonatan Rengifo a los alias**, aunque en la reunión del 5-ago sea él. "Speaker A" no es un apodo: es el orden en que la diarización oyó las voces y se reparte de nuevo en cada reunión. El alias le daría a Jhonatan, para siempre, el trabajo del primero que hable.
- **Escribe el navegador, no el endpoint.** Así pasa por RLS con la sesión del usuario en vez de saltárselo con la service key.
- **La bandeja es de revisión, no un botón de sincronizar.** Nada entra sin marcarse, y lo ya importado se muestra en gris en vez de esconderse: una bandeja que oculta lo procesado hace dudar si algo entró o nunca llegó, y esa duda termina en una reunión creada a mano y duplicada.

### Tres bugs propios, todos encontrados MIDIENDO y no deduciendo

1. **El nombre real venía DENTRO del paréntesis.** `Speaker C (Mari Cruz)` → me quedaba con "Speaker C" y tiraba el nombre. 5 de 12 tareas habrían quedado con etiquetas de diarización. Se encontró **previsualizando el dato antes de que la founder probara** — sin eso, habría gastado la sesión mirando nombres basura.
2. **La bandeja mostraba el nombre crudo y guardaba otro.** El alias solo se aplicaba al importar, así que la previsualización mentía: revisabas "Mari Cruz" y la tarea quedaba "Marisol Ochoa". **Es otra vez el fallo de los dos traductores del 11-ago** — la misma lógica en dos sitios y la copia que nadie mira se queda atrás. Se resolvió igual: una sola función.
3. **`PARALELO_DESDE` y `PARALELO_VENTANA_DIAS` se pisaban.** El arranque efectivo es el mayor de los dos, así que mover la fecha al 1-ago con la ventana en 10 días no habría hecho nada — y **habría parecido que funcionó**, porque la reunión del 5 entra igual.

Además, la bandeja salió vacía en producción mientras el mismo filtro daba 1 reunión en local. En vez de perseguirlo se le agregó al endpoint un **diagnóstico permanente** que cuenta cuántas reuniones sobreviven a cada escalón y qué proyectos ve la llave. (Era el deploy sin propagar.) **La regla del 11-ago se aplicó sola: cuando la deducción falla, se mide.**

### La llave de Paralelo no es una llave

Estamos leyendo con **el JWT de la sesión personal de la founder** — dice su email y su rol por dentro. Funciona, pero se cae cuando caduque y la app lee "como si fuera ella". **Ya se pidió a Paralelo una llave de servicio de solo lectura**, junto con la pregunta de si su plataforma trae webhooks (sería configuración y no desarrollo) y la cotización. Sin respuesta al 14-ago.

### Ampliación: el reporte deja de desperdiciarse

Su reporte trae **14 secciones y solo se leían 2**. Ahora cada reunión alimenta tres sitios: `dependencies` → campo **`input`** (el chip IN que ya existía; 8 de las 12 tareas del 5-ago lo traen), decisiones y objetivos → **resumen de la reunión**, y riesgos y bloqueos → **ROPRE** como items de tipo `risk`. Paralelo ya entrega el riesgo emparejado con su mitigación, que es justo la forma de un item ROPRE.

**Lo que NO se hizo, a propósito:** enlazar las tareas entre sí por `dependsOn` para verlas en el Gantt. El emparejamiento sería por texto y un enlace mal puesto muestra una secuencia falsa. Se deja para cuando sepamos qué tan consistente es el dato.

### Pendientes

- Respuesta de Paralelo: llave de servicio, webhooks, cotización.
- Habilitar Ikigai (117 reuniones, entran como `management`), Andrea Torres (23) y Floppy (inactivo). Están escritos y comentados.
- Corregir a mano el responsable "Speaker A" en la tarea de Black November.
- Ajenos a esto: 48 tareas vencidas y 2 duplicadas detectadas en la vista global.

---

## 2026-08-11 (cierre) — Verificado en producción: el espacio del miembro funciona de punta a punta

La founder probó el ciclo completo con la cuenta de Juan Camilo: **crear tarea personal → recargar → sobrevive → completar → deshacer → crear para un cliente**, y desde su propia cuenta confirmó que **la tarea personal de otra persona no le aparece**.

**Por qué merece entrada propia:** el punto de la recarga había fallado **cinco veces** y fue lo que destapó el bug de los dos traductores. Que ahora aguante confirma que aquello era la causa raíz y no otro parche encima.

La Fase 2 pasa de *construida* a *verificada*, que no es lo mismo — de hecho, media semana de esta historia consistió justamente en descubrir que algo "construido" no funcionaba.

**Queda cerrado, entonces:**
- Lo privado es privado de verdad (agujero del 10-ago tapado y comprobado desde dos cuentas)
- El equipo puede crear tareas — no podía en absoluto hasta el 10-ago
- Cada persona tiene su rincón personal, transversal y no atado al calendario

**Siguiente: Pieza 3, Google Calendar.** Sigue sin empezar. Antes de diseñarla faltan dos datos que la founder tiene que traer: qué abre el equipo un lunes además de Project360, y si usan Google Workspace, Outlook o están mezclados.

---

## 2026-08-11 — La causa raíz de todo: dos traductores de fila y 13 campos que se borraban en cada recarga

**5 commits en `main`, desplegados.** Sesión dedicada a los pasos B (herramienta) y A (auditoría), que terminó destapando el bug que explicaba media semana de síntomas.

### 1. EL BUG (commit `36b7c0a`)

Había **dos funciones distintas** traduciendo la misma fila de Supabase a objeto de la app: la de `repositories.ts` y **una copia en `bootstrap.ts`**. La carga inicial usaba la copia, y la copia se había quedado atrás. Perdía **13 campos en cada recarga**:

- `esPrivada` y `propietarioId` — **en tareas Y reuniones**
- `externalId`, `origen`, `meetingId`, `meetingNombre`, `meetingFecha`, `updatedAt`
- `isAgency`, `sigla`, `activeFunnelId`

**Lo que explica, todo de una:**
- *"Creo una tarea privada y al recargar aparece como normal"* — la base **siempre** guardó bien; la CARGA le borraba la marca. Se persiguió media tarde entre policies, permisos y migraciones. **Nada de eso estaba mal.**
- *"No aparece la opción Personal ni el (interno)"* — `isAgency` se perdía, así que el Espacio de Agencia era un cliente más para la app.
- **`externalId` es el campo con el que Paralelo empareja sus tareas** y se perdía en cada carga. Esa integración habría fallado sin explicación aparente.

**Arreglo:** una sola función. Se exportan los tres traductores de `repositories.ts` y se borran las copias.

### 2. LA LECCIÓN, que vale más que el arreglo

Por deducción NO salía: se verificó el dato (`is_agency=true`), los permisos (`clients_via_agency`), la existencia de la columna y la carga (3 clientes) — **todo correcto, y el síntoma seguía**. Cuatro diagnósticos por deducción, cuatro fallos, cuatro vueltas de la founder.

Se encontró **midiendo**: imprimiendo el valor CRUDO del servidor al lado del ya traducido. Dos líneas de consola seguidas —`Ikigai Agencia=true` y `Espacios de agencia: 0`— señalaron el punto exacto en un segundo.

**REGLA: cuando la deducción falla dos veces, se deja de deducir y se mide.** Los logs de diagnóstico se quedan permanentes en `bootstrap.ts`, no como temporales: responder esa pregunta costó cinco rondas.

*Detalle menor con su propia lección: el primer log imprimía un array, que la consola pliega, y "léeme esta línea" se convirtió en otra vuelta. Se cambió a texto plano. Un diagnóstico que exige instrucciones para leerse no está terminado.*

### 3. PASO B — herramienta (commit `a5d1b1d`)

CLI de Supabase (vía brew, **no** como dependencia del proyecto: el CI se lo bajaría en cada push sin necesitarlo) + Docker Desktop. Autenticado y enlazado.

Nace **`pruebas/probar_migracion.sh`**: aplica una migración contra una COPIA LOCAL del esquema real de producción, informa qué columnas y policies cambia, y comprueba idempotencia. No toca producción.

**Límite conocido:** las migraciones se llaman `034_x.sql` y el CLI espera `<timestamp>_x.sql`, así que **NO se adopta `supabase db push`** — renombrar 37 archivos ya aplicados a mano sería ruidoso y arriesgado. Aplicarlas sigue siendo manual; lo que cambia es que ahora se prueban antes.

### 4. PASO A — la auditoría base vs repo

Se descargó el esquema real y se comparó tabla por tabla contra las 37 migraciones:
- 20 tablas, 2 triggers, 41 policies → **todas documentadas**
- 1 función huérfana: `rls_auto_enable()`, un disparador que activa RLS en cualquier tabla nueva. Buena red de seguridad, nadie la conocía. No se recrea (necesita superusuario) pero queda anotada para que nadie la borre.
- **10 columnas que ninguna migración crea** y que la app usa a diario: 8 de `tasks` (`subtasks`, `comments`, `tag`, `input`, `output`, `depends_on`, `start_date`, `origin`), `meetings.agency_id` (la del agujero del 10-ago) y `task_links.created_by_nombre`.

**Migración 038 (NO corrida):** las documenta. Es `add column if not exists` puro — en la base actual su efecto es CERO. **Y por primera vez, verificada ANTES de pedirla:** aplicada sobre el esquema real en local → 0 cambios en 259 columnas, e idempotente.

*Nota de método: la primera versión de la auditoría buscaba el nombre de la columna en TODO el repo y daba falsos negativos (`agency_id` "existía" porque `clients` la tiene). Se rehízo comparando por par tabla+columna.*

**Pendientes:**
- **Correr la 038** (efecto cero, ya verificada).
- **Probar el ciclo del miembro** ahora que la carga no borra la privacidad: crear personal → recargar → completar desde la lista.
- **Pieza 3: Google Calendar** — sigue sin empezar. Incluye **sustituir el interruptor de mentira** de Configuración (5 integraciones que solo guardan un booleano en el navegador).
- Considerar Playwright con una cuenta de pruebas: hoy el cuello de botella fue no poder mirar el navegador yo misma.

---

## 2026-08-10 — 🔴 Lo privado nunca fue privado + el espacio del miembro deja de ser de solo consumo

Sesión larga y con tres hallazgos que nadie buscaba. **8 commits en `main`, todo desplegado. Migraciones 034, 035, 036 y 037 corridas en prod.**

### 1. AGUJERO DE SEGURIDAD: las tareas y reuniones privadas nunca lo fueron (migración 034)

La 030 (05-ago) creó lo privado y reemplazó las policies **por su nombre**. Pero **en Postgres las policies permisivas se SUMAN**: basta que UNA deje ver la fila para que se vea. Quedaron tres vivas sin comprobación:

- `tasks_via_client` (de la 004) — exponía lo privado a la dueña de la agencia
- `meetings_team_via_agency` — igual
- `meetings_team_read` — **la grave: cualquier miembro del equipo leía las reuniones de la agencia, privadas incluidas**

O sea: desde el día que se lanzó la función, no funcionaba. **Se descubrió probando a mano** — no lo detectó ningún typecheck, ninguna de las 69 pruebas, ni el script de verificación de seguridad de la API, que comprobaba que RLS estuviera ENCENDIDO pero no que las policies fueran coherentes entre sí.

**Arreglo:** `tasks_via_client` se borra (su reemplazo con comprobación ya existía desde la 030 — tener las dos ERA el bug); las dos de meetings se reescriben idénticas + `puede_ver_fila()`, porque son el único camino por el que el equipo ve la agenda interna.

**Efecto que la founder debe saber: ahora ella tampoco ve lo privado de su equipo.** Es lo que se decidió el 05-ago ("un espacio privado que el jefe puede leer no es un espacio privado"), pero hasta hoy no era cierto.

### 2. DEUDA DE FONDO: el repo no refleja la base

`meetings_team_read`, `meetings_team_via_agency` y la columna `meetings.agency_id` **no están en ninguna migración** — se crearon a mano en la consola de Supabase. Por eso ninguna migración las tocó y nadie sabía que existían. **Esta fue la causa raíz del agujero**, y puede volver a morder: cualquier migración futura puede pisar algo que no sabe que existe. La 034 las deja documentadas.

### 3. BUG: al crear una tarea se perdía todo menos 7 campos

El formulario manda ~20 campos y el código de creación enumeraba 7 a mano. Se descartaban en silencio KPI, etiqueta, link de Drive, subtareas, comentarios, dependencias — **y `esPrivada`**. Marcar "privada" al crear NO hacía nada: la tarea nacía pública. No se había notado porque **editarla después sí funciona** (ese camino manda el patch completo). Verificado que no afectó a datos reales: 0 tareas creadas entre el 05 y el 10-ago.

### 4. Lo que se construyó (Fases 1 y 2 del espacio personal)

Petición: *"que cada miembro sienta un espacio donde hacer todas sus gestiones"*. Se descartó empezar por Google Calendar (lo más caro y con dependencias externas) y se hizo primero lo que ya estaba a medio construir:

- **"Mi semana"**: rejilla Lun-Dom con sus tareas y reuniones de TODOS sus clientes. Antes había que entrar cliente por cliente.
- **Selector de destino al crear** (vista global), con opción **"🔒 Personal"**.
- **Botón "+ Nueva tarea" en Mi Espacio** con formulario corto (título, destino, fecha). El formulario completo es herramienta de PM y se queda en el módulo del cliente.
- **"Mis tareas personales"**: lista transversal, sin depender de la semana. Vino de una crítica de la founder al probarlo: *"deberían vivir en un espacio transversal"*. Tenía razón — solo en la rejilla, una tarea sin fecha no tiene dónde vivir.

**Decisión de modelo: "Personal" NO es un concepto de la base.** `tasks.client_id` es obligatorio, así que una tarea personal se guarda en el Espacio de Agencia marcada como privada. Cero migraciones de esquema. Si con uso real se queda corto, se hará la migración con datos en la mano.

### 5. HALLAZGO: un miembro del equipo NUNCA pudo crear tareas (migración 035)

Salió revisando las policies por el agujero anterior. Tenía SELECT y UPDATE, pero ningún INSERT. **El "espacio del miembro" era de solo consumo:** marcaba como hecho lo que le mandaban, no podía anotar lo suyo. Difícil que se sienta propio. Se añaden dos policies: sus propias filas privadas (cuelguen de donde cuelguen) y crear en sus clientes si es `editor` (no `viewer`).

### 6. Tres errores míos encadenados, y su causa común

Los tres se veían igual desde fuera —"la tarea se pierde"— y hicieron falta tres rondas:

1. **La policy se bloqueaba a sí misma** (036): comprobaba la agencia del destino consultando `clients` a pelo. Dentro de una policy, una consulta a otra tabla con RLS **se filtra por los permisos de quien inserta** — y el miembro no puede ver el Espacio de Agencia. La comprobación puesta para que nadie escribiera en casa ajena era la que impedía escribir en la propia. → **Regla: si una policy necesita mirar algo que el usuario no puede ver, va por una función `security definer`.** El resto del proyecto ya lo hacía; acá me lo salté.
2. **La interfaz cantaba victoria antes de tiempo:** decía "creada" sin esperar a la base. Rompí en código nuevo la regla escrita el 01-ago. Ahora `addTask` devuelve si se guardó, retira la fila optimista al fallar y deja el modal abierto con lo escrito.
3. **Fallo de diseño, el de fondo: le di al miembro un sitio donde escribir que no puede leer.** La app carga tareas por "mis clientes" y el Espacio de Agencia no es uno de ellos: la fila se guardaba bien y no volvía nunca. Arreglado en 3 sitios con el mismo criterio: **lo privado propio entra siempre, sin mirar de qué cliente cuelga.**

**Causa común de los tres: escribí reglas de permisos sin poder ejecutarlas.** Sin acceso a la base, cada regla se verifica cuando la founder la corre, y cada error se paga con un viaje de ida y vuelta. **Refuerza el pendiente de instalar el CLI de Supabase** (abierto desde el 05-ago).

### 7. Regla nueva sobre las alarmas

`auditar_privacidad()` (034) dio falsa alarma **dos veces** (con la policy de filas propias y con la de INSERT, que no tiene condición de lectura). Se corrigió las dos veces en vez de explicarse, porque **el agujero de la 034 sobrevivió precisamente porque nadie miraba las policies**: una comprobación en la que no se confía no se mira, y una que no se mira no sirve. Mismo criterio que con el linter el 05-ago.

**Pendientes:**
- **Probar el ciclo completo con la cuenta del miembro** tras el último despliegue (crear personal → recargar → completar desde la lista).
- **Pieza 3: Google Calendar** — traer las citas personales a la app. Es de donde partió la petición. Requiere proyecto en Google Cloud, pantalla de consentimiento y permiso individual. **Y hay que sustituir el interruptor de mentira** de Configuración (5 integraciones que solo guardan un booleano en el navegador) antes de que alguien lo active creyendo que hizo algo.
- **Auditar qué más hay en la base que el repo no conoce.** Es la deuda que causó el agujero.
- Instalar el CLI de Supabase para poder probar migraciones antes de pedirlas.
- Probar en pantalla táctil de verdad (el hover invisible se arregló a ciegas).

---

## 2026-08-06 — API pública v1 EN PRODUCCIÓN: Tareas y Agenda para aplicaciones externas

10 commits, todos en `main` y desplegados. Migraciones **032 y 033 corridas en prod** y verificadas. **Probada contra producción con una llave real: 24/24.**

**Contexto:** cierra el lado nuestro de la integración con Paralelo (Ikigai GM), abierta desde el 29-jul. Alcance deliberadamente estrecho: **solo Tareas y Agenda**. Clientes, métricas, entregables, equipo y ROPRE no se exponen.

**1. Decisión de arquitectura: el multi-tenant ya existía, un nivel más abajo.** El spec proponía activar `agencia_id` en todas las tablas o renunciar al aislamiento. Ninguna de las dos: `clients.agency_id` existe desde el `schema.sql` original, y `tasks`/`meetings` cuelgan de `client_id`. La API deriva la agencia por ese camino. **Cero migraciones de columnas, cero backfill** — y sobre todo, cero filas que se queden con `agencia_id` nulo, que es exactamente cómo un multi-tenant a medias termina filtrando datos.

**2. Decisión de seguridad, la que sostiene todo: el aislamiento vive en la BASE, no en JavaScript.** El spec pedía RLS "como respaldo del filtro del middleware". **Eso no funciona:** la service key de Supabase se salta RLS por diseño, así que las policies de la 030 no frenan a la API. Si el filtro viviera solo en el middleware, sería la única barrera. Solución: la API **no consulta `tasks` ni `meetings`** — llama 7 funciones `security definer` (migración 033) que reciben el `agencia_id` de la llave y filtran por dentro. Para servir una fila ajena habría que editar el SQL a propósito. Las 3 reglas que cumplen todas: filtran por agencia, excluyen `es_privada`, y devuelven columnas explícitas (nunca `select *`, para que una columna sensible nueva no se filtre sola).

**3. Decisión sobre las llaves: se guarda el hash, nunca la llave.** SHA-256; en claro existe un solo instante, en la respuesta de creación. Robar la base no da llaves usables. Aleatoriedad con `crypto.getRandomValues` y rechazo de muestras para no sesgar el alfabeto. **La migración 032 NO tiene policy de INSERT sobre `api_keys` a propósito:** si el frontend pudiera insertar, elegiría el hash y la autenticación dejaría de significar nada.

**4. Decisión de alcance: los 7 endpoints de una, pero la escritura se entrega cuando la founder quiera.** El scope es opcional por llave, así que se puede dar una llave de solo lectura hoy y otra con escritura cuando la integración esté probada, sin tocar código. Barreras de escritura acordadas: **ningún endpoint borra**; `PATCH` solo mueve `status` (no es "editar tarea", una integración con bug no puede reescribir títulos ni fechas); no toca `in_review` (409); todo lo creado queda con `origen='api'` para poder aislarlo y limpiarlo con un `WHERE`; `POST` idempotente por `external_id` para que un reintento no duplique.

**5. Decisión de privacidad: la agenda NO expone transcripción, notas ni tareas extraídas.** Es lo más sensible que guarda la app —la conversación literal del equipo y del cliente— y ninguna integración de agenda la necesita. Si algún día hace falta, será un permiso aparte y una decisión consciente.

**6. TRAMPA EVITADA (la de siempre):** la 029 dejó el CHECK de `tasks.origen` en `(manual, reunion, embudo, ia)`. Marcar las filas de la API con `'api'` habría sido **rechazado en silencio** desde el cliente REST. La 033 amplía el CHECK ANTES de que exista el endpoint. Tercera vez que esta trampa aparece en el proyecto.

**7. Tres fallos que SOLO aparecieron probando en producción** — ninguno lo habrían encontrado las 69 pruebas automáticas, y vale la pena recordarlo:

- **Las llamadas de llaves revocadas eran invisibles en el panel.** Se guardaban con `agencia_id` nulo y la policy de lectura exige que no lo sea. La alerta de "posible ataque" no se habría disparado nunca en el caso más probable: una integración con la llave revocada llamando cada minuto.
- **El audit log perdía filas y se saltaba dos caminos.** Se escribía sin esperar confirmación, y en Vercel la función se apaga al responder llevándose la escritura pendiente (6 de 126 perdidas). Además el 405 y el rechazo por HTTP devolvían sin registrar. **Consecuencia real de seguridad: el rate limit cuenta esa tabla, así que no protegía.** Arreglo: UNA sola salida —el envoltorio registra, ningún camino lo hace por su cuenta— y la escritura se espera (~100 ms por llamada; es el precio de que el registro y el límite sean de verdad).
- **La prueba del rate limit era incapaz de disparar.** 110 llamadas en secuencia a ~0.9 s cada una se reparten en ~100 s contra una ventana de 60: nunca había más de ~65 dentro. El código estaba bien. Verificado en paralelo: 150 llamadas contra un límite de 100 → 102 pasaron, 48 frenadas. **Este fallo enmascaró al anterior durante dos rondas.**

**Regla que sale de esto:** un aviso amarillo ("no se alcanzó el tope, no es un fallo") es lo que dejó pasar el problema dos veces. Si una comprobación de seguridad no se cumple, es **fallo**, no aviso.

**8. Decisión de proceso: `api/` no estaba en NINGÚN tsconfig.** El código que habla con la service key era el único que nadie revisaba. Nuevo `tsconfig.api.json`; `typecheck` corre los dos proyectos. No se referencia desde `tsconfig.json` porque los proyectos referenciados deben emitir (TS6310) y llenaría `api/` de `.d.ts`. Y otra regla aprendida a golpes: **verificar con `npm run typecheck | tail -2 && …` no verifica nada** — el pipe hace que el estado de salida sea el de `tail`, siempre 0. Se subió un error de tipos así; el CI lo atrapó en 47 s.

**9. Herramientas nuevas de verificación, ambas en el repo:** `npm run test:api` (69 pruebas que compilan los endpoints REALES con un Supabase falso; ya en el CI) y `pruebas/probar_api_produccion.sh` (24 comprobaciones contra producción con una llave real). Y `supabase/verificacion_seguridad_api.sql`, de solo lectura, que comprueba RLS, que las funciones sean `security definer` con `search_path` fijo, que `anon` no pueda ejecutarlas, y hace una prueba real de aislamiento.

**10. Se descartó un proyecto del alcance.** Se eliminaron sus menciones del código, pruebas, documentación e historial (única excepción hecha a la regla de que este log no se reescribe; el nombre sigue en el historial de git, que no se reescribió por no ser un dato sensible). **La regla que ilustraba se mantiene:** un proyecto que exista en la app externa y no esté dado de alta en Project360 se rechaza con 400 — ni fila huérfana ni descarte silencioso.

**Pendientes:**
- **Revocar la llave de prueba** (`pk_live_hS9s…`): quedó expuesta en la conversación de trabajo.
- **Decidir quién escribe el lado de Paralelo** — es lo único que falta para que la integración funcione. Project360 ya expone todo. Tres escenarios: hay acceso al código de Ikigai GM / lo hace un equipo de Ikigai / es herramienta de terceros y no se puede tocar. **Es coordinación entre proyectos: va por el Maestro, no por esta terminal.**
- Entregar `API_PUBLICA.md` + una llave de **solo lectura** a quien integre; la de escritura, después.

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
---

# Decisión registrada — Responsables de tarea: limpieza y deuda

**Fecha:** 25 de agosto de 2026

## Qué pasó

La lista "Todas las personas" del módulo de Tareas mostraba **34 nombres
distintos para 13 personas**. No era caos: eran cuatro causas separadas.

1. **Apodos de las transcripciones** (Juanca, Tati, Santi, Robert, Jona, Luis,
   Loro, Luisa, Cisco). La tabla de alias existe desde el 13-ago, pero solo se
   aplica a lo importado DESPUÉS. Todo el histórico entró crudo.
2. **Etiquetas de diarización** — "Speaker A" y "Speaker B" asignados como si
   fueran personas. Corregidas a mano por la founder.
3. 🔴 **Slugs de rol escritos donde va una persona** — `platforms`, `expert`,
   `project_manager`, `designer`, `funnel_builder`. Vienen de
   `ai_brain_data.initialDeliverables[].responsibleRole`, que trae un ROL.
4. **Nombres de equipos** — "Equipo de marketing", "Equipo técnico/operacional".

**Por qué importaba:** los KPIs buscan el nombre EXACTO
(`tasks.assignedTo === memberName`). Juan Camilo aparecía con 35 tareas cuando
tenía 46. Media plantilla llevaba meses mal medida.

## Cómo se resolvió

- 28 apodos inequívocos → unificados sin preguntar.
- 16 más → resueltos por la founder uno a uno.
- Los slugs de rol se resolvieron **por búsqueda, no por suposición**: cada
  tarea es de un cliente, y se miró quién tiene ese rol en ese cliente. Donde
  había DOS candidatos (`funnel_builder`) o NINGUNO, se preguntó.
- Regla mantenida en todo momento: **un responsable raro se corrige en dos
  clics; uno asignado a la persona equivocada no lo corrige nadie.**

**Resultado: 34 → 14 nombres, 0 tareas sin ficha.**

## Fichas nuevas (decisión de la founder)

- **David Guerrero** como `expert` en su propio espacio — el cliente es el
  experto de su nicho, que es justo para lo que existe ese rol.
- **Francisco Otalvaro** como `onboarding` (Líder de Servicio) en David
  Guerrero. No es de nómina; se acepta que cuente en el módulo de Equipo.

## 🔴 DEUDA ACEPTADA — no arreglada a propósito

**Juan Camilo Correa está registrado como `funnel_builder` (Líder Operativo) en
los tres clientes, pero es COO de Ikigai.** El catálogo de 13 roles NO tiene un
rol de dirección, y crear uno se decidió dejarlo para después. Efectos mientras
tanto: se le miden KPIs de un rol que no ejerce, y sale como candidato cuando se
busca quién es el Líder Operativo (que es Roberto Maestre).

## Pendiente de revisar — fichas replicadas

Cada persona tiene ficha en LOS TRES clientes, probablemente por "copiar el
equipo desde otro cliente". Pero Sofía Vasquez es Content Manager solo de Andrea
Torres y Santiago Ruiz solo de David Guerrero. O sea que hay fichas en clientes
donde esa persona no trabaja, y eso ensucia los KPIs por cliente.
**La founder pidió revisarlo DESPUÉS de cerrar esto.**

## Lo que hay que arreglar para que no se repita

1. **El generador de fichas de cliente** escribe el rol donde va la persona.
   Mientras no se toque, cada cliente nuevo vuelve a generar tareas asignadas a
   `platforms` o `designer`.
2. **`assigned_to` es texto libre.** El arreglo de fondo es que asignar sea
   ELEGIR DE UNA LISTA. Sin eso, esto se vuelve a ensuciar solo.
