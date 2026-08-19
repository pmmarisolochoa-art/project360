# Auditoría — 18 de agosto de 2026

## Resumen

Primera pasada. **Un hallazgo grave: la regla que se arregló el 1 de agosto solo se aplicó a un store de ocho.** Quedan 23 rutas de escritura que fallan en silencio — el usuario cree que guardó y no guardó. Incluye código que escribí yo ayer. Además, el rol de dirección queda desbloqueado (Lorenzo y Juan Camilo ya son usuarios) y sigue sin existir.

---

## Hallazgos nuevos

### [1 · Pérdida de datos] El arreglo de "las escrituras avisan al fallar" cubrió 1 store de 8

**Dónde:** 23 rutas de escritura en 7 stores.

| Store | Rutas en silencio | Qué se pierde |
|---|---|---|
| `useFunnelLaunchStore.ts` | 7 | embudos, fases y **tareas creadas desde un lanzamiento** |
| `useProgramsStore.ts` | 3 | programas del cliente |
| `useRopreStore.ts` | 3 | **riesgos, objetivos y entregables** |
| `useTeamMembersStore.ts` | 3 | altas y ediciones de personas del equipo |
| `useContentStore.ts` | 3 | piezas de contenido |
| `useTeamStore.ts` | 2 | asignaciones de rol |
| `useProjectionStore.ts` | 2 | proyecciones |

**Qué pasa:** el 1 de agosto se estableció que ninguna escritura falla en silencio, y se aplicó a las 9 rutas de `useClientStore` (clientes, tareas, reuniones). **Los otros siete stores nunca se tocaron.** Todos siguen el patrón viejo:

```ts
void RopreRepo.create(item).catch((e) => console.warn('[ropre.create]', e));
```

El usuario crea un riesgo en el ROPRE, lo ve aparecer, se va tranquilo. Si la base rechazó la escritura, nadie se entera hasta que alguien recarga días después y el riesgo no está. Es exactamente el síntoma que costó media semana en agosto, en siete módulos más.

**Regla:** R-13 (ninguna escritura falla en silencio) y R-14 (la interfaz no canta guardado antes de la confirmación).

**Agravante — esto me señala a mí:** la importación de Paralelo que construí ayer vuelca riesgos y bloqueos al ROPRE usando `useRopreStore.add`. Hereda el fallo. Si esa escritura falla, el resumen dice *"3 al ROPRE"* y no entró ninguno. **Escribí código nuevo sobre una ruta que incumple una regla ya establecida**, y ni el typecheck ni el CI podían avisar.

**Propuesta:** mover `onWriteError()` de `useClientStore` a un módulo compartido y aplicarlo a las 23 rutas. Es mecánico y de bajo riesgo. **El orden importa:** primero ROPRE y funnel (datos de clientes reales, y el funnel además crea tareas), después equipo, y al final proyecciones y contenido.

**Lo que se rompería si se hace mal:** si el aviso salta también cuando no hay conexión a Supabase en desarrollo, se convierte en ruido y se acaba ignorando — que es cómo mueren estas alarmas. Debe distinguir "la base rechazó" de "no hay base".

---

### [2 · Permisos] El rol de dirección sigue sin existir, y ya no está bloqueado

**Dónde:** `src/routes/AppRouter.tsx:63`

**Qué pasa:** cualquier usuario con rol `member` se redirige a `/mi-espacio` y no puede entrar a `/tareas` ni a `/agenda-global`. Lorenzo (CEO) y Juan Camilo (CTO) **ya son usuarios**, así que hoy están viendo la app como miembros: solo lo suyo, en los clientes que tengan asignados.

**Regla:** R-12 (❌ conocida). **Novedad: deja de estar bloqueada** — el dato que faltaba ya lo tenemos.

**Propuesta:** tercer nivel entre dueña y miembro. Ve todo lo del equipo, no administra, y **lo privado le sigue estando vedado** (confirmado). Toca router, permisos y RLS: no es mecánico y merece su propia sesión.

---

### [3 · Regla nueva propuesta] Un arreglo de regla se aplica a TODOS los sitios, o se anota lo que queda fuera

El hallazgo 1 no ocurrió por descuido: el 1 de agosto se arreglaron las 9 rutas que dolían y las otras 23 quedaron fuera **sin que nadie lo anotara**. Meses después parecen arregladas, porque la regla dice que lo están.

**Regla propuesta — R-39:** cuando se establece una regla y se aplica a parte del código, lo que queda fuera se escribe en el mismo commit y aparece en este informe hasta cerrarse. Una regla aplicada a medias es peor que no tenerla: da por seguro lo que no lo está.

---

### [3 · No hace lo que la founder dice] Una persona solo puede tener un rol, y en la realidad tiene varios

**Dónde:** `src/types/teamMember.ts` — `TeamMember.rol` es un único `TeamRoleSlug`. La columna `team_members.rol` es un solo texto.

**Qué pasa:** Jhonatan Rengifo es estratega **y** copywriter. Hoy la única forma de representarlo es tener dos fichas suyas — que es justo lo que estamos borrando por duplicado. Al fusionarlo hay que elegir uno y perder el otro.

**Cómo se descubrió:** al limpiar los duplicados. Dos de los seis "duplicados" no eran un error de la app: eran una persona con dos trabajos, y la app obligaba a partirla en dos para poder representarla. **El duplicado era el síntoma; el modelo es la causa.**

**Consecuencias más allá de la ficha:** sus KPIs son los de un solo rol, la "Salud del equipo" lo cuenta en un solo sitio, y el reparto de tareas por rol nunca le va a proponer trabajo del otro.

**Propuesta:** `rol` pasa a ser el rol principal y se añade `roles_extra`. Es una columna nueva, la interfaz de la ficha y los conteos de Equipo. No es enorme, pero tampoco es de hoy.

**Parche mientras tanto:** Jhonatan queda como estratega con las funciones de copywriter añadidas a su lista. No pierde información visible, pero sus KPIs siguen siendo de un solo rol.

---

## Seguimiento

Arreglado desde la última vez (no había informe previo; se toma la semana):

- ✅ R-04 — "interna" pasa a decidirse por el cliente y no por el tipo *(18 ago)*
- ✅ R-16 — un solo traductor por tabla. **Comprobado hoy: los 12 traductores están definidos una sola vez.** Sin regresión.
- ✅ R-17 — la previsualización de Paralelo muestra lo que se guarda *(14 ago)*
- ✅ R-31 — un proyecto sin cliente avisa en amarillo en vez de desaparecer. **Ya cazó un caso real: el cliente Ikigai está guardado con otro nombre.**

Sigue abierto:

- ❌ R-29 — Paralelo se lee con la sesión personal de la founder *(esperando su respuesta)*
- ❌ R-32 — 5 interruptores de mentira en Configuración *(bloqueado por Pieza 3)*
- ⚠️ R-11 — las reglas de permisos siguen sin probarse con una cuenta de cada rol

---

## Salud del sistema

**Comprobadas hoy y cumpliéndose:** R-01, R-02 (una sola fila, dos vistas), R-16 (traductores únicos), R-19 (los CHECK de `origen` incluyen todos los valores del union de TypeScript).

**Empeoró:** ninguna.

**Sin comprobar todavía:** R-18 (que el repo refleje la base) exige comparar contra producción — no se hizo hoy. R-20, R-21 y R-37 necesitan ejecutar cosas, no leerlas.

**Nota sobre este informe:** es la primera pasada y es la más productiva por definición — encuentra la deuda acumulada de meses. Los siguientes deberían ser mucho más cortos. Si dentro de dos semanas siguen saliendo cinco hallazgos diarios, algo va mal: o el sistema se está degradando, o el auditor está inventando trabajo.
