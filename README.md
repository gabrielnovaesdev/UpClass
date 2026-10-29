# Upclass — site

Site institucional da Upclass (iPhones e acessórios com procedência garantida). Feito com Vite, GSAP (ScrollTrigger e SplitText), Lenis e three.js.

## Como rodar

```bash
npm install
npm run dev      # servidor local em http://localhost:5173
npm run build    # gera a versão de produção em dist/
npm run preview  # serve a pasta dist/ para conferência
```

## Onde preencher os contatos

Os contatos ficam todos em **`src/js/config.js`**, no objeto `CONTACT`:

```js
export const CONTACT = {
  whatsapp: '',   // só números, com DDI e DDD. Ex.: '5521999999999'
  instagram: '',  // sem o @. Ex.: 'upclassphone'
  address: '',    // endereço da loja em uma linha
  maps: '',       // link do Google Maps (opcional)
  region: 'Baixada Fluminense — RJ',
};
```

Enquanto um campo estiver vazio, o site mostra "em breve" naquele ponto (rodapé e botão "Falar com a Upclass"). Ao preencher, os links passam a abrir o WhatsApp, o Instagram e o mapa automaticamente.

## Estrutura

- `index.html`: todas as seções (conteúdo estático, acessível sem JavaScript).
- `src/css/main.css`: base, intro, menu e hero. `src/css/sections.css`: demais seções e rodapé.
- `src/js/`: `intro.js`, `hero.js` e `bolt3d.js` (raio 3D; a passagem da hero para o manifesto também fica em `hero.js`), `sections.js` (animações de scroll, inclusive os cards de vidro da Coleção), `evo-section.js` e `evolution.js` ("A evolução": o filme em WebGL), `detail.js` + `detail3d.js` ("Na Upclass, cada detalhe é importante": palavras em perspectiva com objetos 3D da marca), `morph.js` (ícone do rodapé que se transforma), `video.js` (carregamento preguiçoso dos vídeos), `config.js` (contatos).
- Fundo claro compartilhado: as seções calmas, os Detalhes, a Coleção e o rodapé usam a classe `.atmo` (névoa lavanda com brilhos rosa e ciano, definida em `main.css`), para lerem como um único espaço.
- `qa/`: scripts do Processo testador (ver `CLAUDE.md`).
- `public/video/`: vídeos da marca otimizados para a web (WebM/MP4, sem áudio, com poster). `preview-*` é um trecho sem legendas do filme (20–26 s) que roda em loop atrás do PLAY ▶ REEL; o filme completo (`film-*`) abre no diálogo.
- `public/img/`: texturas do raio, fundos, mockups (`mk/`, AVIF + WebP) e fotos de produto (`cards/`: iPhone 17 Pro Max, capas, Apple Watch, iPhone azul e MacBook, 800 e 1600 px em AVIF + WebP, geradas a partir de `Upclass Phone/identidade visual/`).

Quem prefere menos movimento (`prefers-reduced-motion`) recebe a página estática, sem pins nem vídeos em reprodução automática. Aparelhos fracos ou sem WebGL recebem a seção dos Detalhes como lista estática (mesmo conteúdo), e o filme como player simples. Com movimento reduzido, os cards da Coleção viram uma fileira com rolagem lateral e o ícone do rodapé fica parado no raio.
