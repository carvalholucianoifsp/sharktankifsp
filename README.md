# Pregão da Turma — deploy no Netlify

Estrutura: public/index.html (app), netlify/functions/api.mjs (servidor), package.json, netlify.toml.
Os dados ficam no Netlify Blobs (já incluso no Netlify, sem configurar nada).

## Opção A — GitHub (recomendada)
1. Suba esta pasta para um repositório no GitHub.
2. Netlify > Add new site > Import an existing project > escolha o repositório > Deploy.

## Opção B — Netlify CLI
npm install
npm install -g netlify-cli
netlify login
netlify deploy --prod   (na 1a vez, crie o site e confirme publish dir "public")

PIN inicial do professor: 2026 (troque no painel). Depois do deploy, abra o endereço
*.netlify.app, entre em Professor > QR Code e projete para a turma.
