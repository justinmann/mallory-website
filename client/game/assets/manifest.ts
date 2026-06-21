// Placeholder pixel-art sprites. Vite turns each PNG import into a URL string.
// To use your OWN art: replace these .png files (keep the same names), or add
// new imports here and load them in createGame.ts.
import player from './player.png';
import lecternOxblood from './lectern-oxblood.png';
import lecternForest from './lectern-forest.png';
import lecternPlain from './lectern-plain.png';
import floor from './floor.png';
import wall from './wall.png';

export const SPRITES = {
  player,
  'lectern-oxblood': lecternOxblood,
  'lectern-forest': lecternForest,
  'lectern-plain': lecternPlain,
  floor,
  wall,
} as const;
