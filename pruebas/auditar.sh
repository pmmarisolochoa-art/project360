#!/bin/bash
#
# Auditoría diaria de Project360 — corre en ESTE computador.
#
# POR QUÉ AQUÍ Y NO EN LA NUBE: la cuenta de Claude es compartida con la
# agencia y el repositorio es personal. Conectarlos habría requerido rehacer la
# conexión de GitHub de la cuenta compartida, y eso le quita el acceso a quien
# más la use. No vale la pena por un informe diario.
#
# Lo que pierde: si el computador está apagado a la hora, esa corrida se salta
# (launchd la lanza al despertar si estaba dormido). Lo que gana: no toca nada
# compartido y el repositorio no sale de aquí.
#
# Qué hace:
#   1. Trae lo último de main.
#   2. Lanza al agente `auditor` (.claude/agents/auditor.md) en modo sin
#      interfaz, con permiso SOLO de lectura + escribir su informe.
#   3. Commitea y sube el informe.
#   4. Intenta enviarlo por correo y Telegram, si están configurados.
#
# Se instala con pruebas/instalar_auditor.sh y a partir de ahí corre solo.

set -uo pipefail

REPO="/Users/marisolochoalopez/Desktop/CLAUDE/project360"
LOG="$REPO/informes/.auditor.log"
FECHA="$(date +%F)"

cd "$REPO" || { echo "No existe $REPO"; exit 1; }
mkdir -p informes

echo "════════════════════════════════════════" >> "$LOG"
echo "[$(date '+%F %T')] Arranca la auditoría de $FECHA" >> "$LOG"

# El token bueno vive en el llavero; el exportado en el shell está caducado y
# tapa al otro. Es un problema conocido desde el 5-ago.
export -n GITHUB_TOKEN 2>/dev/null || true

git pull --quiet --rebase origin main >> "$LOG" 2>&1 \
  || echo "[aviso] No se pudo traer main; se audita lo que hay en disco." >> "$LOG"

PROMPT="Eres el auditor de Project360. Lee .claude/agents/auditor.md — son tus instrucciones completas — y REGLAS_del_Sistema.md, que es tu contrato. Revisa también los informes anteriores en informes/ para no repetir hallazgos y hacer seguimiento de lo abierto.

Audita el código del repositorio contra las reglas. Mide, no deduzcas: cada hallazgo con archivo, línea y el escenario concreto del usuario. No inventes trabajo — si no hay nada nuevo, dilo en una línea.

Escribe el informe en informes/${FECHA}-auditoria.md con la estructura exacta que define .claude/agents/auditor.md. Ese archivo es lo ÚNICO que puedes crear o modificar: no toques código, no arregles nada, no hagas commits (de eso me encargo yo después).

Termina con el resumen: cuántos hallazgos nuevos, de qué prioridad, y qué sigue abierto."

# --permission-mode acceptEdits: puede escribir su informe sin preguntar, pero
# no puede correr comandos peligrosos. El agente ya tiene prohibido tocar código
# en su propia definición; esto es el cinturón además de los tirantes.
claude -p "$PROMPT" \
  --permission-mode acceptEdits \
  >> "$LOG" 2>&1

INFORME="informes/${FECHA}-auditoria.md"
if [ ! -f "$INFORME" ]; then
  echo "[ERROR] El auditor no dejó $INFORME. Mira el log de arriba." >> "$LOG"
  exit 1
fi

# Solo se commitea el informe. Si el auditor tocó algo más —no debería— se
# queda sin subir y salta a la vista en el próximo `git status`.
git add "$INFORME" >> "$LOG" 2>&1
if git diff --cached --quiet; then
  echo "[$(date '+%F %T')] El informe no cambió respecto al anterior." >> "$LOG"
else
  git commit -q -m "docs(auditoria): informe del ${FECHA}" >> "$LOG" 2>&1
  git push -q origin main >> "$LOG" 2>&1 \
    && echo "[$(date '+%F %T')] Informe subido." >> "$LOG" \
    || echo "[ERROR] El commit se hizo pero el push falló." >> "$LOG"
fi

# Correo y Telegram, si hay credenciales. Sin ellas no falla: el informe ya
# está en el repositorio, que es la entrega mínima garantizada.
if [ -f "$REPO/.env.auditor" ]; then
  set -a; . "$REPO/.env.auditor"; set +a
  node "$REPO/pruebas/enviar_informe.mjs" "$INFORME" >> "$LOG" 2>&1
else
  echo "[aviso] Sin .env.auditor: el informe no se envió por correo ni Telegram." >> "$LOG"
fi

echo "[$(date '+%F %T')] Terminado." >> "$LOG"
