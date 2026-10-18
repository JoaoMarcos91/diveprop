// Registro dos cenários.
import { buildFields } from './fields.js';
import { buildFactory } from './factory.js';
import { buildTower } from './tower.js';
import { buildRace } from './race.js';
import { buildBeach } from './beach.js';
import { buildValley } from './valley.js';
import { buildQuarry } from './quarry.js';
import { buildGym } from './gym.js';
import { buildPlant } from './plant.js';

export const SCENES = [
  { id: 'fields', name: 'Campos e Árvores', desc: 'Fazenda com celeiro vazado, sebes, floresta de pinheiros, estrada de terra, fios de alta tensão e um lago.', tag: 'Freestyle · aberto', sky: 'partlyCloudy', seed: 11, build: buildFields },
  { id: 'factory', name: 'Fábrica Abandonada', desc: 'Galpão de tijolos com janelas quebradas e telhado furado, mezanino, contêineres, tanques e uma chaminé oca de 50 m: mergulhe por dentro e saia pela porta.', tag: 'Bando · técnico', sky: 'overcast', seed: 23, ambient: 1.35, build: buildFactory },
  { id: 'tower', name: 'Prédio Inacabado', desc: 'Esqueleto de concreto de 12 andares, andaime, guindaste de 56 m e prédios vizinhos. Feito para dives.', tag: 'Dive · urbano', sky: 'sunset', seed: 37, build: buildTower },
  { id: 'race', name: 'Pista de Corrida', desc: 'Circuito com 10 portões (um elevado e um dive gate), cronômetro de volta e melhor volta salva.', tag: 'Corrida · cronometrado', sky: 'cloudy', seed: 53, build: buildRace },
  { id: 'beach', name: 'Praia', desc: 'Enseada com mar, coqueiros, píer de madeira para voar entre os pilares, farol num rochedo e barcos ancorados.', tag: 'Freestyle · litoral', sky: 'noon', seed: 61, build: buildBeach },
  { id: 'valley', name: 'Vale nas Montanhas', desc: 'Montanhas de até 400 m (plataforma com repetidora de vídeo no pico, para dives longos), rio, cachoeira caindo num lago, ponte alta e floresta de pinheiros.', tag: 'Mountain surfing · natureza', sky: 'ridge', seed: 71, build: buildValley },
  { id: 'quarry', name: 'Pedreira', desc: 'Cava em bancadas com lago no fundo, duas torres de resfriamento ocas de 90 m (entre por baixo e saia pelo topo), britador e esteiras.', tag: 'Bando · industrial', sky: 'quarry', seed: 83, build: buildQuarry },
  { id: 'plant', name: 'Usina Abandonada', desc: 'Termelétrica desativada com duas chaminés ocas de 85 e 100 m, torre de escada de 20 andares com poço aberto para ladder dive, galeria da esteira para voar por dentro e salão das turbinas.', tag: 'Bando · dives', sky: 'sunset', seed: 109, build: buildPlant },
  { id: 'gym', name: 'Ginásio Indoor', desc: 'Quadra coberta com pista de tiny whoop cronometrada, arquibancada, cordas e cestas de basquete — passe pelo aro!', tag: 'Whoop · indoor', sky: 'gym', seed: 97, indoor: true, fog: false, suggestDrone: 'whoop', suggestLabel: 'Tiny Whoop', build: buildGym },
];
