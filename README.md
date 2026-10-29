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
- `src/js/`: `intro.js`, `hero.js` e `bolt3d.js` (raio 3D), `sections.js` (animações de scroll), `evo-section.js` e `evolution.js` ("A evolução": o filme em WebGL), `symbol.js` ("O símbolo": anatomia do raio 3D), `video.js` (carregamento preguiçoso dos vídeos), `config.js` (contatos).
- `qa/`: scripts do Processo testador (ver `CLAUDE.md`).
- `public/video/`: vídeos da marca otimizados para a web (WebM/MP4, sem áudio, com poster). `preview-*` é um trecho sem legendas do filme (20–26 s) que roda em loop atrás do PLAY ▶ REEL; o filme completo (`film-*`) abre no diálogo.
- `public/img/`: texturas do raio, fundos, mockups (`mk/`, AVIF + WebP) e quadros do filme (`film/`).

Quem prefere menos movimento (`prefers-reduced-motion`) recebe a página estática, sem pins nem vídeos em reprodução automática. Celulares e aparelhos mais fracos recebem versões sem pin (e sem WebGL quando o aparelho não aguenta) das seções 02 e 03, com os mesmos conteúdos e controles.
