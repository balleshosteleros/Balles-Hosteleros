#!/bin/bash
# Servicio de arranque automatico del localhost (Balles Hosteleros)
# Lo gestiona macOS (launchd): arranca al encender el Mac y se reinicia solo si se cae.

export PATH="/Users/ivanballesteros/.nvm/versions/node/v20.20.2/bin:/usr/local/bin:/usr/bin:/bin"
cd "/Users/ivanballesteros/Balles Hosteleros" || exit 1

# Libera el puerto 3000 por si quedo un proceso zombi de un arranque anterior
lsof -ti:3000 | xargs kill -9 2>/dev/null

# Arranca el servidor de desarrollo (Turbopack, hot reload)
exec npm run dev
