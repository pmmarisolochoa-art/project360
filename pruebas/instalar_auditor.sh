#!/bin/bash
#
# Instala (o desinstala) la auditoria diaria en este computador.
#
#   bash pruebas/instalar_auditor.sh            -> instala, todos los dias 7:00
#   bash pruebas/instalar_auditor.sh 9          -> instala a las 9:00
#   bash pruebas/instalar_auditor.sh --quitar   -> la desinstala
#
# Usa launchd, que es el cron de macOS. Si el computador esta dormido a esa
# hora, la corrida se lanza en cuanto despierta. Si esta apagado, se salta.

set -euo pipefail

REPO="/Users/marisolochoalopez/Desktop/CLAUDE/project360"
ETIQUETA="com.ikigai.project360.auditor"
PLIST="$HOME/Library/LaunchAgents/$ETIQUETA.plist"

if [ "${1:-}" = "--quitar" ]; then
  launchctl unload "$PLIST" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Auditoria diaria desinstalada."
  exit 0
fi

HORA="${1:-7}"
chmod +x "$REPO/pruebas/auditar.sh"
mkdir -p "$HOME/Library/LaunchAgents"

cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$ETIQUETA</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$REPO/pruebas/auditar.sh</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>$HORA</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>$REPO/informes/.auditor.out</string>
  <key>StandardErrorPath</key><string>$REPO/informes/.auditor.err</string>
  <key>RunAtLoad</key><false/>
</dict>
</plist>
PLISTEOF

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

echo "Auditoria diaria instalada: todos los dias a las $HORA:00."
echo "Se desinstala con: bash pruebas/instalar_auditor.sh --quitar"
echo "Para probarla ahora mismo:  bash pruebas/auditar.sh"
