#!/bin/bash
# Lançador do FPVsim para macOS: sobe o servidor local e abre o jogo no Safari
# (em Macs antigos o Safari costuma ter WebGL mesmo quando o Chrome não tem).
# Para só jogar, não precisa disto: https://joaomarcos91.github.io/fpvsim/
cd "$(dirname "$0")" || exit 1

if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js não encontrado. Instale em https://nodejs.org (gratuito) e rode de novo."
  read -r -p "Enter para sair"; exit 1
fi
if [ ! -d node_modules ]; then
  echo "Primeira execução: instalando dependências (uma vez só)…"
  npm install || { read -r -p "Falhou. Enter para sair"; exit 1; }
fi
if [ ! -f public/assets/manifest.json ]; then
  echo "Baixando texturas e céus gratuitos (CC0, ~56 MB, uma vez só)…"
  npm run assets
fi

URL="http://127.0.0.1:5173/"
if curl -s -o /dev/null "$URL"; then
  echo "Servidor já estava rodando."
else
  npx vite --host 127.0.0.1 --port 5173 --strictPort >/tmp/fpvsim-server.log 2>&1 &
  SERVER=$!
  trap 'kill $SERVER 2>/dev/null' EXIT
  for _ in $(seq 1 40); do curl -s -o /dev/null "$URL" && break; sleep 0.5; done
fi
open -a Safari "$URL"
echo ""
echo "FPVsim rodando em $URL (Safari)."
echo "Conecte o controle (ou rádio FPV em modo joystick) e aperte qualquer botão com o jogo aberto."
echo "Para fechar o servidor, feche esta janela ou aperte Ctrl+C."
wait
