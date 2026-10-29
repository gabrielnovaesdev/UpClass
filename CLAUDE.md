# Instruções do projeto — site Upclass

Visão geral, comandos e estrutura estão no [README.md](README.md). Este arquivo guarda as regras de trabalho.

## Regras de conteúdo

- Nunca usar "sonho", "conquista", "realização" nem "esforço" em textos para o cliente (manual da marca, p. 26).
- Não inventar serviços, depoimentos, números ou condições. Troca de usado, seminovos, assistência técnica e parcelamento não estão confirmados.
- Não expor dados internos da marca (market share, concorrentes, público-alvo).
- Contatos ficam só em `src/js/config.js`; vazios aparecem como "em breve".
- Intro, menu e hero estão aprovados: não alterar visualmente.
- Seções minimalistas e clean, sem textos acessórios: nada de rótulos de seção ("( 02 — … )"), subtítulos que só descrevem a seção, HUDs de player ("Filme da marca", cronômetro), contadores ("01 / 04") ou tickers decorativos.

## Processo testador

Quando o pedido mencionar **"Processo testador"**, executar o ciclo abaixo antes de entregar — e não parar na primeira versão que funciona:

1. **Reanalisar a referência** indicada (por exemplo, https://lusion.co/): composição, tipografia, profundidade, rolagem, cursor, ritmo e mobile. Registrar o que não foi possível verificar.
2. **Inspecionar o projeto rodando** (`npm run dev`) num navegador real com GPU. O painel embutido do app pode ficar oculto e estrangular o rAF/WebGL; nesse caso usar o Chrome headless dos scripts em `qa/`.
3. **Comparar criticamente**: estética, composição, originalidade, acabamento, fluidez, responsividade, acessibilidade e desempenho.
4. **Listar diferenças concretas** (o que está pior que a referência e por quê), sustentadas por capturas e medições.
5. **Corrigir.**
6. **Retestar, incluindo regressões** nas seções vizinhas e nas transições entre elas.

Cobertura mínima de cada rodada:

- Desktop (1440×900) e mobile (390 e 320 px de largura), além de `prefers-reduced-motion`.
- Console sem erros nem avisos; sem rolagem horizontal; sem sobreposições nem saltos de layout.
- Interações por toque (sem depender de hover) e por teclado (foco visível, `aria-pressed`/`aria-current` coerentes).
- FPS medido durante a rolagem (mediana e p95) e renderização pausada fora da tela.
- Ordem e continuidade das seções depois que todos os pins foram calculados.
- Distinguir sempre **emulação** (Chrome headless com viewport/touch emulados) de **dispositivo real**; dizer explicitamente quando um teste não foi feito em aparelho real.

Ferramentas (precisam do Chrome instalado e de `npm i --no-save puppeteer-core`; o servidor de dev deve estar rodando):

```bash
node qa/shoot.mjs desktop .sym ./qa-out/sym 12 4.2   # capturas passo a passo de uma seção + FPS + console
node qa/shoot.mjs mobile .evo ./qa-out/evo-m 8 1.6
node qa/shoot.mjs desktop-reduce .sym ./qa-out/sym-r 3 1
node qa/interact.mjs                                  # toque, teclado, player no celular e ordem das seções
node qa/sections.mjs desktop                         # uma captura por seção + console (também: mobile)
node qa/reel.mjs                                      # PLAY ▶ REEL: hover, abrir/fechar o filme (clique, Esc, teclado), celular
```

## Git

- Versionar só esta pasta `site/` (nunca `node_modules`, `dist`, `qa-out` ou os arquivos-fonte da marca); nenhum arquivo acima de 50 MB; nunca force push.
- Mensagens de commit em português.
