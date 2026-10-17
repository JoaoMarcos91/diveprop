# FPVsim

Simulador de drone FPV em 3D que roda direto no navegador, com física realista, 4 cenários
e tudo configurável. Joga com controle de videogame (PS3, PS4, PS5, Xbox, Switch) ou com
rádio FPV de verdade. 100% gratuito.

### ▶ Jogar: **https://joaomarcos91.github.io/fpvsim/**

![Campos e Árvores](docs/fields.jpg)

## Como jogar

1. Abra o link acima num navegador atualizado (Chrome, Edge, Firefox ou Safari).
   Clique em **⛶** (canto superior direito) para tela cheia.
2. Conecte o controle (USB ou Bluetooth) e **aperte qualquer botão** — o navegador só mostra o
   controle depois disso.
3. Escolha **Voar → cenário**, abaixe o throttle e aperte **R1** (ou **RB**) para armar.

Nunca voou FPV? Aperte **L1** para trocar para o modo **Angle**, que nivela o drone sozinho.
No modo **Acro** (padrão) o drone fica no ângulo em que você deixar, como os drones reais
de freestyle.

> Se o 3D não aparecer, o navegador está sem WebGL2: ative a aceleração de hardware nas
> configurações dele ou tente outro navegador. Em Macs antigos o Safari costuma funcionar
> melhor que o Chrome.

## Controles

| Controle (Modo 2) | Ação |
|---|---|
| Stick esquerdo ↕ / ↔ | Throttle / Yaw |
| Stick direito ↕ / ↔ | Pitch / Roll |
| R1 / RB | Armar / desarmar (throttle embaixo) |
| △ / Y | Resetar o drone |
| □ / X | Câmera: FPV → terceira pessoa → linha de visada |
| L1 / LB | Modo de voo: Acro → Angle → Horizon |
| ✕ / A (segurar) | Turtle mode (desvirar depois de capotar) |
| D-pad ↑ / ↓ | Ângulo da câmera (uptilt) |
| D-pad ← / → | FOV |
| Options / Menu | Pausa. Nos menus: D-pad navega, ✕/A confirma, ○/B volta |

Teclado (reserva): W/S throttle, A/D yaw, setas pitch/roll, Espaço arma, R reset,
C câmera, M modo, T turtle, Esc pausa, `[` `]` uptilt, `,` `.` FOV.

O stick de um controle de videogame volta ao centro sozinho, então por padrão o centro é
50% de throttle (segure o stick). Em **Configurações → Controle** dá para usar só a metade
de cima do stick ou o gatilho **R2/RT** como throttle.

### Controles e rádios suportados

- **PlayStation 3, 4 e 5** (DualShock 3, DualShock 4, DualSense e DualSense Edge),
  **Xbox**, **Switch Pro** e controles genéricos. O jogo reconhece o modelo e mostra os nomes
  certos dos botões (✕○□△ ou A B X Y).
- **Rádios FPV** (RadioMaster, Jumper, FrSky, TBS, BetaFPV… com EdgeTX/OpenTX) ligados no USB
  em modo **Joystick (HID)**. Entram sozinhos no layout **AETR**, com **CH5** armando por chave
  mantida (igual ao Betaflight: se a chave já estiver ligada ao conectar, não arma),
  **CH6** trocando o modo de voo e **CH7** turtle. Também tem layout TAER.
- Cada controle/rádio guarda o próprio perfil (canais, botões, calibração). Qualquer botão
  ou chave pode ser remapeado, e "Detectar" descobre o eixo certo quando você mexe o stick.
- O PS3 depende do sistema reconhecer o controle (no Windows, com DsHidMini; no Linux,
  direto).

### Vibração (haptics)

Controles que vibram tremem nas batidas (proporcional ao impacto), forte no crash, e dão um
toque ao armar e ao passar pelos portões da corrida. Opcionalmente, também vibram
continuamente com os motores e a turbulência (propwash).

| Navegador | Vibração |
|---|---|
| Chrome / Edge | PS4, PS5, Xbox, Switch Pro. No Xbox, vibra também os **gatilhos** |
| Safari 16.4+ | PS4, PS5, Xbox |
| Firefox | Só se a vibração de gamepad estiver ligada no navegador |

Ajuste ou teste em **Configurações → Controle → Vibração**. Rádios FPV não vibram.

## Cenários

| | |
|---|---|
| ![Fábrica](docs/factory.jpg) **Fábrica Abandonada** — galpão de tijolos com janelas quebradas e telhado furado, treliças, mezanino, contêineres e tanques. | ![Chaminé](docs/chimney.jpg) **A chaminé** — 50 m de altura, oca: entre por cima, mergulhe por dentro e saia pela porta na base. |
| ![Dentro da chaminé](docs/chimney-dive.jpg) **Mergulho na chaminé** | ![Prédio](docs/tower.jpg) **Prédio Inacabado** — esqueleto de 12 andares, andaime, guindaste de 56 m e estacionamento. |
| ![Pista](docs/race.jpg) **Pista de Corrida** — 10 portões, cronômetro e melhor volta salva. | ![Campos](docs/fields.jpg) **Campos e Árvores** — fazenda, celeiro vazado, floresta, fios de alta tensão e lago. |

## O que dá para configurar

- **Rates**: fórmulas Betaflight (RC rate, super rate, expo) e Actual, por eixo, com
  gráfico; curva de throttle (mid/expo/limite).
- **Física**: 5 presets (Tiny Whoop, Cinewhoop 3", Freestyle 5", Racer 5", Long Range 7")
  e cada parâmetro: massa, empuxo por motor, braço, inércias, tempo de resposta dos
  motores, passo da hélice (limita a velocidade final), arrasto por eixo, arrasto dos
  rotores, densidade do ar, gravidade, propwash, efeito solo, vento e rajadas, bateria
  (células, mAh, resistência interna → *voltage sag*), colisões e crash.
- **Controladora**: Acro / Angle / Horizon, airmode, idle, PID (P, I, D, feedforward),
  filtros, ruído do gyro.
- **Câmera**: uptilt, FOV, fisheye, vídeo analógico (ruído, estática, perde sinal longe ou
  atrás de paredes) ou digital, vibração, terceira pessoa e linha de visada.
- **Gráficos**: presets Muito baixo → Ultra, escala de resolução, resolução dinâmica,
  limite de FPS, distância de visão, sombras, materiais PBR, normal maps, vegetação,
  grama, anisotropia, MSAA.

Tudo fica salvo no navegador e pode ser exportado/importado em JSON (aba Áudio/Jogo).

## Desempenho

Feito para rodar bem até em notebooks antigos com vídeo integrado: nos testes, o preset
**Médio** ficou em ~60 FPS e o **Alto** em ~30 FPS num notebook de 2012. A resolução dinâmica
baixa a resolução sozinha quando o FPS cai. Duas armadilhas resolvidas (comentadas no
código):

- Em algumas combinações de navegador/GPU antiga, geometria **não indexada**
  (`drawArrays`) chega a ser 100× mais lenta — toda a geometria do jogo é indexada
  (`src/kit.js`).
- O passo do Rapier fica lento com milhares de colisores, mesmo estáticos — toda a
  geometria estática vira **um único trimesh** (`Kit.finalizeColliders`).

## Para desenvolvedores

```bash
npm install
npm run assets
npm run dev
```

…e abrir `http://127.0.0.1:5173/`. No macOS também dá para dar duplo-clique em
`Iniciar FPVsim.command`, que faz tudo isso e abre o Safari.

- `npm run deploy` gera o build e publica no GitHub Pages (branch `gh-pages`).
- `http://127.0.0.1:5173/?dev=1` liga um canal de testes (`src/dev.js`) que aceita comandos
  em `.devreports/cmd.json`: carregar cenário, piloto automático, controles simulados,
  screenshots e benchmarks.
- `tests/ui.html` mostra só os menus (funciona até em navegador sem GPU).

```
src/main.js        laço do jogo, carregamento de cenários, perfis de controle
src/drone.js       física: rates → PID → mixer/airmode → motores → aerodinâmica → Rapier
src/rates.js       fórmulas de rates do Betaflight
src/input.js       Gamepad API (controles e rádios, chaves) + teclado
src/controllers.js identificação do controle, nomes dos botões, suporte a vibração
src/haptics.js     vibração (dual-rumble, trigger-rumble, pulse)
src/settings.js    padrões, presets, layouts, schema da tela de configurações
src/ui.js          menus, configurações, calibração, remapeamento
src/osd.js         OSD estilo Betaflight
src/render.js      renderizador, pós-processamento FPV, resolução dinâmica
src/assets.js      materiais (texturas CC0) e céus HDRI
src/kit.js         ferramentas de montagem: caixas, terreno, árvores, grama, colisores
src/scenes/*.js    os 4 cenários
scripts/           download das texturas e publicação
PROMPT.md          a especificação usada para construir o jogo + a decisão app × site
```

## Créditos e licenças

- Texturas e céus HDRI: [Poly Haven](https://polyhaven.com), licença **CC0** (domínio
  público).
- [Three.js](https://threejs.org) (MIT), [Rapier](https://rapier.rs) (Apache-2.0),
  [Vite](https://vite.dev) (MIT).
- Árvores, folhagem, grama, drone e prédios são gerados por código neste projeto.
