# 🔁 Loop Engineering — cómo y cuándo usarla

> Nota para mi yo del futuro. Instalado el 2026-07-05. Hoy NO se usa; se guarda para cuando toque automatizar.

---

## ¿Qué es? (en cristiano)
Herramienta para poner a un agente AI a hacer **tareas repetitivas y aburridas solo**, sin dirigirlo cada vez:
- Revisar PRs nuevos y comentarlos
- Ordenar y clasificar issues cada mañana
- Barrer errores de CI (tests que fallan)
- Limpiar el repo después de cada merge

**No sirve para** construir features nuevas (eso lo sigo haciendo yo con Claude normal).

---

## ¿CUÁNDO sacarla? (las 3 señales)
Enciende un loop cuando project360 tenga **al menos una** de estas:

1. **Muchos PRs/issues** que revisar cada día y me quita tiempo.
2. **Un equipo** metiendo cambios y necesito un "guardián" automático de calidad.
3. **CI corriendo** (tests automáticos) que a veces se rompe y hay que vigilar.

👉 Regla simple: **si una tarea la repito >3 veces por semana y es mecánica → candidata a loop.**

Mientras project360 esté en MVP y yo construyendo solo → **NO es el momento.**

---

## ¿CÓMO se usa? (cuando llegue el momento)

### Paso 1 — Ver qué tan listo está el repo
```bash
cd ~/Desktop/CLAUDE/project360
loop-audit . --suggest
```
Da un puntaje 0-100 y te dice qué falta con los comandos exactos para completarlo.
(La última vez: 19/100 — normal, aún no montado.)

### Paso 2 — Montar el loop (elegir UN patrón para empezar)
Empieza SIEMPRE por el más suave y de bajo riesgo:

```bash
# El más suave — clasifica issues/cambios cada día:
loop-init . --pattern daily-triage --tool claude

# O vigilar PRs automáticamente:
loop-init . --pattern pr-babysitter --tool claude
```

### Paso 3 — Revisar que quedó bien
```bash
loop-audit .        # debería subir el puntaje
loop-cost .         # cuánto costaría en tokens antes de encenderlo
```

---

## Patrones disponibles (menú)
| Patrón | Qué hace | Riesgo |
|---|---|---|
| `daily-triage` | Ordena cambios/issues cada día | 🟢 bajo (empezar aquí) |
| `issue-triage` | Salud de la cola de issues | 🟢 bajo |
| `changelog-drafter` | Redacta notas de versión | 🟢 bajo |
| `pr-babysitter` | Vigila y comenta PRs | 🟡 medio |
| `ci-sweeper` | Arregla tests rotos de CI | 🟡 medio |
| `dependency-sweeper` | Actualiza dependencias | 🟡 medio |
| `post-merge-cleanup` | Limpia tras cada merge | 🟡 medio |

---

## Comandos que quedaron instalados (en cualquier terminal)
- `loop-audit .` → puntaje de "qué tan listo para loop"
- `loop-init` → arma el loop (scaffolding)
- `loop-cost` → estima costo en tokens
- `loop-sync` → sincroniza estado del loop
- `loop-context` → gestiona el contexto

**Skills en Claude Code** (usar con `/`): `/loop-triage`, `/loop-verifier`, `/loop-budget`, `/minimal-fix`

---

## Dónde vive todo
- Repo de referencia (patterns, ejemplos, docs): `~/loop-engineering` → actualizar con `git pull`
- Guía oficial del método: `~/loop-engineering/README.md` y `~/loop-engineering/LOOP.md`

---

### 🎯 Siguiente paso HOY: ninguno. Seguir con el MVP. Volver a esta nota cuando aparezca alguna de las 3 señales.
