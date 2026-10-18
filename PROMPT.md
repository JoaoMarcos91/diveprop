# Prompt — DiveProp, antes FPVsim (escrito por Claude para Claude)

> Este é o prompt/especificação que usei para construir o jogo. Ele serve como
> "contrato" do projeto: se algo não estiver aqui, não é requisito; se estiver,
> deve funcionar.

---

## Papel

Você é um desenvolvedor sênior de jogos 3D e simulação de voo. Vai construir do zero um
**simulador de drone FPV** que roda no navegador, jogável com controle de videogame
(PS3/PS4/PS5, Xbox, Switch) ou rádio FPV em modo joystick USB, com física realista e tudo
personalizável. Custo zero: apenas ferramentas e assets gratuitos (MIT / CC0).

## Hardware-alvo

Precisa rodar liso em computadores modestos, inclusive notebooks antigos com vídeo
integrado (GPUs Intel de ~2012). Orçamento: **< 80 draw calls, < 400k triângulos, sombras
opcionais, folhagem com alpha-test (sem blending)** e resolução dinâmica.

## Decisão: App ou Site?

| Critério | Site (Three.js + Rapier WASM) | App nativo (Godot 4) | App Electron |
|---|---|---|---|
| Desempenho | Bom se os draw calls forem poucos | Um pouco melhor na CPU; a GPU é o gargalo igual | Igual ao site, com instalador pesado |
| Controles | Gamepad API (controles e rádios) | SDL nativo | Gamepad API |
| Instalação | Nenhuma: é só abrir o link | Baixar e instalar por sistema | Baixar e instalar |
| Interface de configurações | HTML/CSS: rápida e rica | Mais trabalhosa | HTML/CSS |
| Compartilhar com amigos | Um link | Um executável por sistema | Um executável por sistema |
| Custo | Grátis (hospedagem no GitHub Pages) | Grátis | Grátis |

**Decisão: site**, publicado de graça no GitHub Pages. Em Macs antigos o Electron (que é
Chromium) pode ficar sem aceleração de GPU, enquanto o Safari funciona; o site cobre os
dois casos. Godot daria desempenho parecido — o gargalo é a GPU — com muito mais atrito.

## Stack

- **Vite** (dev server + build) · **Three.js** (render WebGL2) · **@dimforge/rapier3d-compat** (colisões/corpo rígido, WASM).
- JavaScript ES modules, sem framework de UI (HTML/CSS puros).
- Assets: texturas PBR e céus HDRI **CC0 da Poly Haven** (baixados por `scripts/fetch-assets.mjs`); árvores, folhas, grama e o drone gerados proceduralmente no código. Fallback procedural para toda textura que faltar — o jogo nunca pode quebrar por falta de asset.

## Física (realista e 100% configurável)

Simular um quadricóptero em X com passo fixo (padrão 500 Hz, configurável):

1. **Rádio → rates**: deadband, fórmulas **Betaflight** (RC rate, super rate, expo) e **Actual** (center sensitivity, max rate, expo) por eixo; curva de throttle (mid/expo).
2. **Controladora de voo**: PID de taxa por eixo (P, I, D com filtro passa-baixa, Feedforward), modos **Acro**, **Angle** e **Horizon**, **Airmode**, idle de motor.
3. **Mixer** em espaço de empuxo com saturação estilo airmode → linearização → comando de motor.
4. **Motores**: atraso de 1ª ordem (subida e descida diferentes), empuxo ∝ rpm², torque reativo de yaw.
5. **Aerodinâmica**: arrasto quadrático por eixo do corpo (frente/lado/topo), arrasto linear de rotor, queda de empuxo com velocidade axial (pitch speed da hélice), **efeito solo**, **propwash** (turbulência ao descer no próprio fluxo), **vento** com rajadas.
6. **Bateria**: células, capacidade, resistência interna → *voltage sag* que reduz empuxo; opção infinita.
7. **Colisões** via Rapier (CCD ligado), atrito/restituição configuráveis, detecção de **crash** por impulso (modos: desarmar / reset automático / indestrutível).
8. **Presets de drone**: Tiny Whoop, Cinewhoop 3", Freestyle 5", Long Range 7" — todos os parâmetros editáveis depois (massa, empuxo, inércias, braço, arrasto, tempos de motor, gravidade, densidade do ar…).

## Controle

- Controles de videogame (PS3/PS4/PS5, Xbox, Switch Pro) e rádios FPV (EdgeTX/OpenTX em modo joystick USB) pela Gamepad API, com perfil salvo por controle. Modo 2 por padrão (esquerdo = throttle/yaw, direito = pitch/roll); rádios começam em AETR.
- Vibração (haptics) em batidas, crashes e portões, onde o navegador permitir (dual-rumble, trigger-rumble do Xbox, pulse do Firefox).
- Mapeamento livre de cada canal (eixo, inverter, calibração min/centro/max, "detectar movendo o stick"), modos de throttle: stick inteiro / metade superior / gatilho R2.
- Botões configuráveis: armar (R1), reset (△), câmera (□), modo de voo (L1), pausa (Options), turtle mode (✕ segurado), D-pad ↑/↓ = ângulo da câmera ao vivo, ←/→ = FOV. No rádio, chaves (eixos) também servem como botões, e armar pode ser por chave mantida.
- Teclado como reserva (para testes).
- Tela de calibração com barras ao vivo.

## Câmera

- FPV com **ângulo de inclinação (uptilt)**, **FOV**, **fisheye** (distorção barrel em pós-processo), efeito **analógico** (ruído, scanlines, perda de sinal por distância/obstáculos) ou digital limpo.
- Terceira pessoa (distância/altura/suavização) e linha de visada (piloto no chão).

## Divulgação e celular

- Prévia do link (Open Graph/Twitter), ícones e manifesto para "adicionar à tela inicial".
- Celular/tablet: sticks e botões na tela (Pointer Events), aviso para deitar o aparelho, primeira
  visita no gráfico Baixo e modo Angle; placa de vídeo forte começa no Alto.
- Texturas 1K recomprimidas (cor 4:2:0 q80, normal/ARM 4:4:4 q85): ~⅓ do download.
- Conta opcional só com usuário e senha (sem e-mail/confirmação) via Firebase REST (Auth +
  Firestore, plano grátis): sincroniza configurações, presets do jogador, controles e voltas;
  gráficos ficam por aparelho. `?cloud=mock` testa sem servidor.
- Português e inglês: o texto em português do código é a chave (`t('Voar')` → "Fly"); idioma
  automático pelo navegador, botão no menu e opção em Configurações.

## Cenários (9)

1. **Fábrica Abandonada** — galpão de tijolos com janelas quebradas, telhado com buracos, treliças, mezanino, contêineres, tanques, entulho, mato e uma chaminé oca de 50 m com porta na base (mergulho por dentro).
2. **Campos e Árvores** — terreno ondulado, sebes, árvores frondosas e pinheiros, estrada de terra, casa de fazenda e celeiro, fardos de feno, postes com fios.
3. **Prédio Inacabado** — esqueleto de concreto de 12 andares (lajes, pilares, escada, vergalhões), guindaste, prédios vizinhos, estacionamento — perfeito para *dives*.
4. **Pista de Corrida** — parque com portões de corrida em circuito, cronômetro de volta, melhor volta e ordem dos portões.
5. **Praia** — enseada com mar animado e espuma, coqueiros, dunas, píer de madeira (voar entre os pilares), farol num promontório de pedras, barcos ancorados, quiosques.
6. **Vale nas Montanhas** — montanhas de até ~400 m (pico aplainado com plataforma e repetidora de vídeo para dives longos), rio sinuoso, lago com cachoeira saindo de um penhasco, ponte de concreto alta, cabana e floresta de pinheiros (*mountain surfing*).
7. **Pedreira** — cava em bancadas com lago no fundo, britador elevado, esteiras transportadoras longas, pilhas de brita, silos, caminhões e escavadeira.
8. **Ginásio Indoor** — quadra coberta com pista de tiny whoop cronometrada, arquibancada, cordas e cestas de basquete com aro vazado.
9. **Usina Abandonada** — termelétrica a carvão com duas chaminés de tijolo ocas (85 e 100 m, porta na base), torre de escada de 20 andares com poço central aberto para *ladder dive* (entra pelo telhado, sai pela porta do térreo), galeria inclinada da esteira de carvão para voar por dentro, casa da caldeira, salão das turbinas, dutos, caixa d'água e subestação.

Cada cenário: céu HDRI próprio (sol calculado a partir do pixel mais brilhante do HDRI para alinhar sombras), neblina casando com o horizonte, ponto de spawn e posição do piloto.

## Gráficos

Presets **Muito baixo / Baixo / Médio / Alto / Ultra** + ajustes individuais:
escala de resolução, resolução dinâmica (alvo de FPS), sombras (off/1024/2048),
materiais (Lambert barato ↔ PBR com normal map), distância de visão, densidade de
vegetação, grama, anisotropia, MSAA, limite de FPS, contador de FPS. Padrão nesta
máquina: **Baixo + resolução dinâmica**.

## Interface

Menu principal (escolha de cenário, status do controle), pausa, configurações em
abas (Controle, Rates, Física, Câmera, Gráficos, Áudio/Jogo) geradas a partir de um
schema, todas salvas em `localStorage`, com "restaurar padrão". OSD estilo Betaflight
(armado, modo, timer, voltagem, mAh, velocidade, altitude, throttle, sinal, crosshair).
Som de motor sintetizado (WebAudio) ligado ao rpm.

## Critérios de aceite

- `npm run dev`: menu abre, os 4 cenários carregam sem erros no console.
- Drone arma, decola, faz flips/rolls em Acro; Angle mode nivela sozinho.
- Mudar qualquer parâmetro de física/rate/câmera tem efeito imediato.
- Num notebook antigo com vídeo integrado, ≥ 45 FPS na maior parte do tempo no preset Médio.
- Nada pago; créditos/licenças dos assets no README.

## Método de verificação

Com `npm run dev` e `?dev=1` na URL, a página liga um canal de testes (`src/dev.js`): manda
erros, FPS e screenshots para o servidor do Vite (`/__devreport`) e recebe comandos
(`/__devcmd`: carregar cenário, piloto automático, controles simulados, tirar foto,
benchmark). Analisar as imagens e números, corrigir, repetir.
