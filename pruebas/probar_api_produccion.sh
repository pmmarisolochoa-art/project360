#!/usr/bin/env bash
#
# Prueba la API pública v1 contra PRODUCCIÓN con una llave real.
#
# Es lo que las pruebas automáticas NO pueden cubrir: `npm run test:api` usa un
# Supabase falso, así que verifica el middleware pero nunca ha ejecutado las
# funciones SQL de la migración 033 ni ha leído un dato de verdad.
#
# USO:
#   PROJECT360_API_KEY='pk_live_…' bash pruebas/probar_api_produccion.sh
#
# SEGURO DE CORRER: no crea, no modifica y no borra nada. Los dos intentos de
# escritura son a propósito, para comprobar que una llave de SOLO LECTURA los
# tiene prohibidos — deben fallar con 403.
#
# La llave se pasa por variable de entorno para que no quede en el historial del
# shell. Si la escribes en la línea del comando, bórrala después del historial.

set -uo pipefail

BASE="${PROJECT360_BASE:-https://project360-pearl.vercel.app}"
KEY="${PROJECT360_API_KEY:-}"

if [ -z "$KEY" ]; then
  echo "❌ Falta la llave. Corre así:"
  echo "   PROJECT360_API_KEY='pk_live_…' bash pruebas/probar_api_produccion.sh"
  exit 1
fi

OK=0; FALLOS=0
UUID_FALSO="33333333-3333-4333-8333-333333333333"

# ── Utilidades ───────────────────────────────────────────────────────────────
# El cuerpo y el código HTTP se piden en la misma llamada: pedirlos por separado
# significaría dos peticiones distintas y podrían no coincidir.
llamar() { # método ruta [body]
  local m="$1" ruta="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -s -m 30 -w '\n%{http_code}' -X "$m" "$BASE$ruta" \
      -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' -d "$body"
  else
    curl -s -m 30 -w '\n%{http_code}' -X "$m" "$BASE$ruta" -H "Authorization: Bearer $KEY"
  fi
}

codigo() { echo "$1" | tail -1; }
cuerpo() { echo "$1" | sed '$d'; }

comprobar() { # descripción esperado obtenido [extra]
  if [ "$2" = "$3" ]; then
    printf '  ✅ %-52s %s\n' "$1" "${4:-}"
    OK=$((OK + 1))
  else
    printf '  ❌ %-52s esperaba %s, dio %s %s\n' "$1" "$2" "$3" "${4:-}"
    FALLOS=$((FALLOS + 1))
  fi
}

# La expresión viaja por variable de entorno, NO incrustada en el código
# Python: interpolarla rompía en cuanto la expresión terminaba en comilla
# (`… else '—'`), porque cerraba el string de tres comillas antes de tiempo.
json() { # expresión python sobre `d` (el JSON de la respuesta)
  EXPR="$1" python3 -c "
import sys, json, os
try:
    d = json.load(sys.stdin)
except Exception:
    print('SIN_JSON'); sys.exit()
try:
    print(eval(os.environ['EXPR']))
except Exception as e:
    print('ERR:' + type(e).__name__)
"
}

seccion() { echo; echo "── $1 ───────────────────────────────────────"; }

echo "═══════════════════════════════════════════════════════════"
echo " API pública v1 — prueba contra $BASE"
echo " Llave: ${KEY:0:12}…  (no se imprime completa)"
echo "═══════════════════════════════════════════════════════════"

# ── 1. Lectura de tareas ─────────────────────────────────────────────────────
seccion "1. Leer tareas"
R=$(llamar GET "/api/v1/tasks?limite=5")
C=$(codigo "$R"); B=$(cuerpo "$R")
comprobar "GET /tasks responde" 200 "$C"

N=$(echo "$B" | json "len(d['data']['tareas'])")
comprobar "la respuesta trae la lista de tareas" "OK" "$([ "$N" != "SIN_JSON" ] && [ "$N" != "ERR:KeyError" ] && echo OK || echo NO)" "→ $N tareas"

PRIMERA_ID=$(echo "$B" | json "d['data']['tareas'][0]['id'] if d['data']['tareas'] else ''")
CLIENTE=$(echo "$B" | json "d['data']['tareas'][0]['cliente'] if d['data']['tareas'] else '—'")
echo "     Primer cliente devuelto: $CLIENTE"

# Los campos privados NUNCA deben aparecer, ni siquiera vacíos.
FUGA=$(echo "$B" | json "'SI' if any(k in (d['data']['tareas'][0] if d['data']['tareas'] else {}) for k in ['es_privada','propietario_id']) else 'NO'")
comprobar "no expone es_privada ni propietario_id" "NO" "$FUGA"

# ── 2. Una tarea concreta ────────────────────────────────────────────────────
seccion "2. Tarea por id"
if [ -n "$PRIMERA_ID" ] && [ "$PRIMERA_ID" != "SIN_JSON" ]; then
  R=$(llamar GET "/api/v1/tasks/$PRIMERA_ID")
  comprobar "GET /tasks/:id de una tarea propia" 200 "$(codigo "$R")"
else
  echo "  ⏭️  Sin tareas para probar (¿la agencia está vacía?)"
fi

R=$(llamar GET "/api/v1/tasks/$UUID_FALSO")
comprobar "id inexistente → 404 (nunca 403)" 404 "$(codigo "$R")"

R=$(llamar GET "/api/v1/tasks/no-es-un-uuid")
comprobar "id con formato inválido → 400" 400 "$(codigo "$R")"

# ── 3. Filtros y paginación ──────────────────────────────────────────────────
seccion "3. Filtros y paginación"
R=$(llamar GET "/api/v1/tasks?status=completed&limite=3")
comprobar "filtro por estado" 200 "$(codigo "$R")" "→ $(cuerpo "$R" | json "len(d['data']['tareas'])") completadas"

R=$(llamar GET "/api/v1/tasks?limite=1")
HAYMAS=$(cuerpo "$R" | json "d['data']['paginacion']['hay_mas']")
comprobar "paginación con limite=1" 200 "$(codigo "$R")" "→ hay_mas=$HAYMAS"

R=$(llamar GET "/api/v1/tasks?limite=999")
comprobar "limite fuera de rango → 400" 400 "$(codigo "$R")"

R=$(llamar GET "/api/v1/tasks?status=inventado")
comprobar "estado inventado → 400" 400 "$(codigo "$R")"

R=$(llamar GET "/api/v1/tasks?client_id=$UUID_FALSO")
comprobar "cliente de otra agencia → lista vacía" "0" "$(cuerpo "$R" | json "len(d['data']['tareas'])")"

# ── 4. Agenda ────────────────────────────────────────────────────────────────
seccion "4. Leer agenda"
R=$(llamar GET "/api/v1/meetings?limite=5")
C=$(codigo "$R"); B=$(cuerpo "$R")
comprobar "GET /meetings responde" 200 "$C" "→ $(echo "$B" | json "len(d['data']['reuniones'])") reuniones"

# Lo más sensible que guarda la app. No debe salir jamás.
FUGA=$(echo "$B" | json "'SI' if any(k in (d['data']['reuniones'][0] if d['data']['reuniones'] else {}) for k in ['transcription','transcripcion','notes','notas','extracted_tasks']) else 'NO'")
comprobar "NO expone transcripción ni notas internas" "NO" "$FUGA"

MID=$(echo "$B" | json "d['data']['reuniones'][0]['id'] if d['data']['reuniones'] else ''")
if [ -n "$MID" ] && [ "$MID" != "SIN_JSON" ]; then
  R=$(llamar GET "/api/v1/meetings/$MID")
  comprobar "GET /meetings/:id" 200 "$(codigo "$R")"
fi

# ── 5. Escritura PROHIBIDA (llave de solo lectura) ───────────────────────────
seccion "5. La llave de solo lectura NO puede escribir"
R=$(llamar POST "/api/v1/tasks" '{"client_id":"'"$UUID_FALSO"'","titulo":"PRUEBA - no debe crearse"}')
comprobar "POST /tasks → 403 permiso insuficiente" 403 "$(codigo "$R")"

R=$(llamar PATCH "/api/v1/tasks/$UUID_FALSO/status" '{"estado":"completed"}')
comprobar "PATCH status → 403" 403 "$(codigo "$R")"

R=$(llamar POST "/api/v1/meetings" '{"client_id":"'"$UUID_FALSO"'","titulo":"PRUEBA","tipo":"general","programada_en":"2026-09-01T10:00:00Z"}')
comprobar "POST /meetings → 403" 403 "$(codigo "$R")"

R=$(llamar DELETE "/api/v1/tasks")
comprobar "DELETE → 405 (la API no borra nada)" 405 "$(codigo "$R")"

# ── 6. Cabeceras ─────────────────────────────────────────────────────────────
seccion "6. Cabeceras de seguridad"
# `-D -` vuelca las cabeceras de un GET normal. Antes se usaba `curl -I`, que
# manda HEAD: un método que esta API no acepta, así que se estaban revisando
# las cabeceras de un 405 y no las de una respuesta de verdad.
H=$(curl -s -D - -o /dev/null -m 30 "$BASE/api/v1/tasks?limite=1" -H "Authorization: Bearer $KEY")
for par in "x-content-type-options:nosniff" "x-frame-options:DENY" "cache-control:no-store"; do
  nombre="${par%%:*}"; valor="${par#*:}"
  encontrado=$(echo "$H" | grep -i "^$nombre:" | tr -d '\r' | sed "s/^$nombre: *//I")
  comprobar "$nombre" "$valor" "${encontrado:-ausente}"
done
CORS=$(echo "$H" | grep -ci "access-control-allow-origin")
comprobar "sin CORS (no se puede llamar desde un navegador)" "0" "$CORS"

# ── 7. Rate limit ────────────────────────────────────────────────────────────
# EN PARALELO, no en secuencia. La primera versión de esta prueba lanzaba 110
# llamadas una detrás de otra y NUNCA disparaba el 429 — y el problema era la
# prueba, no la API: cada llamada tarda ~0.9 s, así que 110 seguidas se reparten
# en ~100 segundos y la ventana del límite es de 60. Nunca había más de ~65
# llamadas dentro de la ventana contra un límite de 100.
#
# Lanzándolas a la vez sí se llena la ventana, que es además como se comportaría
# una integración desbocada de verdad.
seccion "7. Rate limit (esto tarda ~20s)"
LIMITE_ESPERADO=100
DISPAROS=150
echo "     Lanzando $DISPAROS llamadas EN PARALELO (20 a la vez)…"

TMP=$(mktemp)
seq 1 "$DISPAROS" | xargs -P 20 -I{} \
  curl -s -o /dev/null -w '%{http_code}\n' -m 30 \
  "$BASE/api/v1/tasks?limite=1" -H "Authorization: Bearer $KEY" > "$TMP"

FRENADAS=$(grep -c '^429$' "$TMP" || true)
PASARON=$(grep -c '^200$' "$TMP" || true)
rm -f "$TMP"

if [ "$FRENADAS" -gt 0 ]; then
  printf '  ✅ %-52s → %s pasaron, %s frenadas con 429\n' "el rate limit frena de verdad" "$PASARON" "$FRENADAS"
  OK=$((OK + 1))
else
  printf '  ❌ %-52s → %s pasaron, NINGUNA frenada\n' "el rate limit NO frenó" "$PASARON"
  echo "     Si la llave es de 300/min, es normal: hacen falta más disparos."
  FALLOS=$((FALLOS + 1))
fi

# El margen sobre el límite mide la carrera entre llamadas simultáneas: varias
# consultan el contador antes de que las anteriores queden anotadas. Un margen
# pequeño es esperable; uno grande significaría que el conteo va muy por detrás.
if [ "$PASARON" -gt 0 ] && [ "$FRENADAS" -gt 0 ]; then
  MARGEN=$((PASARON - LIMITE_ESPERADO))
  if [ "$MARGEN" -gt 0 ]; then
    echo "     Se colaron $MARGEN por encima del límite de $LIMITE_ESPERADO (carrera entre simultáneas)"
  else
    echo "     Pasaron $PASARON de $LIMITE_ESPERADO: la ventana ya traía llamadas de antes. Correcto."
  fi
fi

R=$(llamar GET "/api/v1/tasks?limite=1")
if [ "$(codigo "$R")" = "429" ]; then
  RA=$(curl -s -D - -o /dev/null -m 30 "$BASE/api/v1/tasks?limite=1" -H "Authorization: Bearer $KEY" | grep -i '^retry-after' | tr -d '\r')
  comprobar "el 429 dice cuánto esperar" "OK" "$([ -n "$RA" ] && echo OK || echo NO)" "→ $RA"
fi

# ── Resultado ────────────────────────────────────────────────────────────────
echo
echo "═══════════════════════════════════════════════════════════"
if [ "$FALLOS" -eq 0 ]; then
  echo " 🟢 $OK comprobaciones pasaron, 0 fallos"
else
  echo " 🔴 $FALLOS FALLOS de $((OK + FALLOS)) comprobaciones"
fi
echo "═══════════════════════════════════════════════════════════"
echo
echo " Ahora entra a Configuración → API y Desarrolladores → Actividad."
echo " Deberías ver todas estas llamadas, con los 403 y 429 en rojo."
echo " Cuando termines: revoca esta llave."
