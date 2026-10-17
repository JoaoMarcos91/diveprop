// Registro dos cenários.
import { buildFields } from './fields.js';
import { buildFactory } from './factory.js';
import { buildTower } from './tower.js';
import { buildRace } from './race.js';

export const SCENES = [
  { id: 'fields', name: 'Campos e Árvores', desc: 'Fazenda com celeiro vazado, sebes, floresta de pinheiros, estrada de terra, fios de alta tensão e um lago.', tag: 'Freestyle · aberto', sky: 'partlyCloudy', seed: 11, build: buildFields },
  { id: 'factory', name: 'Fábrica Abandonada', desc: 'Galpão de tijolos com janelas quebradas e telhado furado, mezanino, contêineres, tanques e uma chaminé oca de 50 m: mergulhe por dentro e saia pela porta.', tag: 'Bando · técnico', sky: 'overcast', seed: 23, ambient: 1.35, build: buildFactory },
  { id: 'tower', name: 'Prédio Inacabado', desc: 'Esqueleto de concreto de 12 andares, andaime, guindaste de 56 m e prédios vizinhos. Feito para dives.', tag: 'Dive · urbano', sky: 'sunset', seed: 37, build: buildTower },
  { id: 'race', name: 'Pista de Corrida', desc: 'Circuito com 10 portões (um elevado e um dive gate), cronômetro de volta e melhor volta salva.', tag: 'Corrida · cronometrado', sky: 'cloudy', seed: 53, build: buildRace },
];
