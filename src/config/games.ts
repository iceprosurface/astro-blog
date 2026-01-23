export interface GameConfig {
  id: string;
  name: string;
  description: string;
  component: string;
}

export const GAMES: GameConfig[] = [
  {
    id: "dino",
    name: "恐龙快跑",
    description: "躲避障碍物的小恐龙游戏",
    component: "DinoGame",
  },
];

export function getRandomGame(excludeId?: string): GameConfig {
  const availableGames = excludeId
    ? GAMES.filter((game) => game.id !== excludeId)
    : GAMES;

  if (availableGames.length === 0) {
    return GAMES[0];
  }

  const randomIndex = Math.floor(Math.random() * availableGames.length);
  return availableGames[randomIndex];
}

export function getGameById(id: string): GameConfig | undefined {
  return GAMES.find((game) => game.id === id);
}

export function getAllGames(): GameConfig[] {
  return [...GAMES];
}
