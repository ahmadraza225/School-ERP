#!/bin/bash
# Kid School System - start the fee software on this Mac.
# Double-click this file in Finder (or run ./start-mac.command in Terminal).
cd "$(dirname "$0")/app" || exit 1

if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js is not installed. Download the LTS version from https://nodejs.org, install it, then run this again."
  read -r -p "Press Enter to close..." _; exit 1
fi

# First run: ask for the Supabase keys and save them in app/.env
if [ ! -f .env ]; then
  echo "First-time setup. Find these in Supabase: Project Settings > API Keys / Data API."
  read -r -p "Supabase Project URL (https://xxxx.supabase.co): " URL
  read -r -p "Supabase publishable key (sb_publishable_...): " KEY
  printf 'VITE_SUPABASE_URL=%s\nVITE_SUPABASE_ANON_KEY=%s\n' "$URL" "$KEY" > .env
  echo "Saved to app/.env"
fi

if [ ! -d node_modules ]; then
  echo "Installing (first time only, takes a minute)..."
  npm install || { read -r -p "Install failed. Press Enter to close..." _; exit 1; }
fi

echo "Building..."
npm run build || { read -r -p "Build failed. Press Enter to close..." _; exit 1; }

IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
echo ""
echo "=============================================="
echo " Kid School System is running."
echo " On this Mac:        http://localhost:5173"
[ -n "$IP" ] && echo " Other office PCs:   http://$IP:5173  (same Wi-Fi/network)"
echo " Keep this window open. Close it to stop."
echo "=============================================="
(sleep 2 && open "http://localhost:5173") &
npx vite preview --host --port 5173 --strictPort
