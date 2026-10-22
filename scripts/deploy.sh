#!/bin/bash
# Publica o jogo no GitHub Pages: gera o build e envia para o branch gh-pages.
# Uso: npm run deploy
set -e
cd "$(dirname "$0")/.."
ORIGIN="$(git remote get-url origin)"
npm run build
touch dist/.nojekyll
cd dist
rm -rf .git
git init -q -b gh-pages
git add -A
git commit -q -m "Publicar build $(date '+%Y-%m-%d %H:%M')"
git push -q -f "$ORIGIN" gh-pages
rm -rf .git
echo "Publicado no branch gh-pages."
