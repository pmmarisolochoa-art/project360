#!/usr/bin/env bash
#
# Prueba una migración contra una COPIA LOCAL del esquema real de producción,
# antes de pedirle a nadie que la corra en Supabase.
#
# USO:
#   bash pruebas/probar_migracion.sh supabase/migrations/039_lo_que_sea.sql
#
# POR QUÉ EXISTE
# El 10-ago tres errores seguidos en migraciones costaron tres rondas de ida y
# vuelta con la founder: se escribía el SQL, ella lo corría, fallaba, se
# corregía. La causa no era falta de cuidado sino de herramienta — no había
# forma de EJECUTAR una migración antes de entregarla.
#
# Con esto se ejecuta contra el esquema real (descargado de producción) en un
# Postgres desechable. Si revienta, revienta acá.
#
# QUÉ NECESITA
#   · Docker Desktop corriendo (la ballena 🐳 en la barra)
#   · supabase CLI autenticado y enlazado (`supabase login` + `supabase link`)
#
# QUÉ NO HACE
# No toca producción en ningún momento. Solo LEE el esquema (sin datos) y
# trabaja sobre una copia local que se borra al terminar.

set -uo pipefail
export PATH="/usr/local/bin:$PATH"

MIGRACION="${1:-}"
if [ -z "$MIGRACION" ] || [ ! -f "$MIGRACION" ]; then
  echo "❌ Uso: bash pruebas/probar_migracion.sh <ruta-a-la-migracion.sql>"
  exit 1
fi

CONTENEDOR=p360_migracion
ESQUEMA="${TMPDIR:-/tmp}/p360_schema_real.sql"

docker info > /dev/null 2>&1 || { echo "❌ Docker no está corriendo. Abre Docker Desktop."; exit 1; }

# ── 1. Esquema real (se reutiliza el del día si ya se bajó) ──────────────────
if [ ! -s "$ESQUEMA" ]; then
  echo "→ Descargando el esquema real de producción (solo estructura, sin datos)…"
  supabase db dump --schema public -f "$ESQUEMA" < /dev/null > /dev/null 2>&1 \
    || { echo "❌ No se pudo. ¿Está enlazado el proyecto? (supabase link)"; exit 1; }
fi
echo "→ Esquema real: $(grep -c 'CREATE TABLE' "$ESQUEMA") tablas"

# ── 2. Postgres desechable ───────────────────────────────────────────────────
docker rm -f "$CONTENEDOR" > /dev/null 2>&1
docker run -d --name "$CONTENEDOR" -e POSTGRES_PASSWORD=test postgres:17-alpine > /dev/null
for _ in $(seq 1 30); do docker exec "$CONTENEDOR" pg_isready -U postgres > /dev/null 2>&1 && break; sleep 2; done

# El volcado de Supabase espera roles y un esquema `auth` que un Postgres pelado
# no trae. Se crean mínimos para que cargue; `auth.uid()` devuelve null, así que
# las policies se CREAN bien aunque no se puedan evaluar con un usuario real.
docker exec -i "$CONTENEDOR" psql -U postgres -q > /dev/null 2>&1 <<'SQL'
do $$ begin create role anon;           exception when duplicate_object then null; end $$;
do $$ begin create role authenticated;  exception when duplicate_object then null; end $$;
do $$ begin create role service_role;   exception when duplicate_object then null; end $$;
do $$ begin create role supabase_admin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticator;  exception when duplicate_object then null; end $$;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
SQL

docker exec -i "$CONTENEDOR" psql -U postgres -q < "$ESQUEMA" 2>&1 | grep -iE "^ERROR" | head -5

COLS="select table_name||'.'||column_name from information_schema.columns where table_schema='public' order by 1"
POLS="select tablename||'.'||policyname from pg_policies where schemaname='public' order by 1"
docker exec "$CONTENEDOR" psql -U postgres -tAc "$COLS" > "${TMPDIR:-/tmp}/antes_cols.txt"
docker exec "$CONTENEDOR" psql -U postgres -tAc "$POLS" > "${TMPDIR:-/tmp}/antes_pols.txt"

# ── 3. La migración ──────────────────────────────────────────────────────────
echo
echo "→ Aplicando $(basename "$MIGRACION")…"
SALIDA=$(docker exec -i "$CONTENEDOR" psql -U postgres -v ON_ERROR_STOP=1 -q < "$MIGRACION" 2>&1)
CODIGO=$?

if [ $CODIGO -ne 0 ]; then
  echo "🔴 LA MIGRACIÓN FALLA — no se la pases a nadie todavía:"
  echo "$SALIDA" | grep -iE "error|línea|line" | head -10
  docker rm -f "$CONTENEDOR" > /dev/null 2>&1
  exit 1
fi
echo "✅ Se aplica sin errores"

# ── 4. Qué cambió exactamente ────────────────────────────────────────────────
docker exec "$CONTENEDOR" psql -U postgres -tAc "$COLS" > "${TMPDIR:-/tmp}/despues_cols.txt"
docker exec "$CONTENEDOR" psql -U postgres -tAc "$POLS" > "${TMPDIR:-/tmp}/despues_pols.txt"

echo
echo "── Columnas ──"
if diff -q "${TMPDIR:-/tmp}/antes_cols.txt" "${TMPDIR:-/tmp}/despues_cols.txt" > /dev/null; then
  echo "   sin cambios"
else
  diff "${TMPDIR:-/tmp}/antes_cols.txt" "${TMPDIR:-/tmp}/despues_cols.txt" | grep -E "^[<>]" | sed 's/^>/   + AÑADE/;s/^</   - QUITA/'
fi

echo "── Policies ──"
if diff -q "${TMPDIR:-/tmp}/antes_pols.txt" "${TMPDIR:-/tmp}/despues_pols.txt" > /dev/null; then
  echo "   sin cambios"
else
  diff "${TMPDIR:-/tmp}/antes_pols.txt" "${TMPDIR:-/tmp}/despues_pols.txt" | grep -E "^[<>]" | sed 's/^>/   + AÑADE/;s/^</   - QUITA/'
fi

# ── 5. Idempotencia: correrla dos veces no puede romper nada ─────────────────
# Es la propiedad que más se rompe sin darse cuenta, y la que más duele: alguien
# la corre de nuevo por si acaso y se lleva un error o un cambio inesperado.
echo
echo "── Idempotencia (aplicarla dos veces) ──"
if docker exec -i "$CONTENEDOR" psql -U postgres -v ON_ERROR_STOP=1 -q < "$MIGRACION" > /dev/null 2>&1; then
  docker exec "$CONTENEDOR" psql -U postgres -tAc "$COLS" > "${TMPDIR:-/tmp}/tercera.txt"
  if diff -q "${TMPDIR:-/tmp}/despues_cols.txt" "${TMPDIR:-/tmp}/tercera.txt" > /dev/null; then
    echo "   ✅ se puede correr las veces que haga falta"
  else
    echo "   ⚠️  la segunda pasada cambia el esquema otra vez — revisar"
  fi
else
  echo "   🔴 falla al aplicarla dos veces — no es idempotente"
fi

docker rm -f "$CONTENEDOR" > /dev/null 2>&1
echo
echo "Copia local eliminada. Producción no se tocó en ningún momento."
