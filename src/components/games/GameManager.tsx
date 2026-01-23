import { useState, useEffect } from "react";
import DinoGame from "./DinoGame";
import type { GameConfig } from "../../config/games";
import { getRandomGame } from "../../config/games";

export default function GameManager() {
  const [currentGame, setCurrentGame] = useState<GameConfig | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [key, setKey] = useState(0); // Used to force remount on restart

  const pickGame = () => {
    const randomGame = getRandomGame(currentGame?.id);
    setCurrentGame(randomGame);
    setKey(prev => prev + 1);
  };

  useEffect(() => {
    const handlePlay = () => {
      if (!currentGame) {
        pickGame();
      }
      setIsPlaying(true);
    };

    const handleRestart = () => {
      pickGame();
    };

    window.addEventListener("play-game", handlePlay);
    window.addEventListener("restart-game", handleRestart);
    return () => {
      window.removeEventListener("play-game", handlePlay);
      window.removeEventListener("restart-game", handleRestart);
    };
  }, [currentGame]);

  if (!isPlaying) {
    return null;
  }

  return (
    <div className="game-manager">
      <DinoGame key={key} onRestart={pickGame} />
    </div>
  );
}
