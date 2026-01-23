import { useEffect, useRef, useState } from "react";
import { RotateCcw, Home } from "lucide-react";

interface DinoGameProps {
  onRestart?: () => void;
}

export default function DinoGame({ onRestart }: DinoGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    ctx.scale(dpr, dpr);

    let animationFrameId: number;
    let gameScore = 0;
    let gameOver = false;

    const dino = {
      x: 50,
      y: rect.height - 60,
      width: 40,
      height: 40,
      dy: 0,
      jumpForce: 12,
      gravity: 0.6,
      isJumping: false,
    };

    let obstacles: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
      speed: number;
    }> = [];

    let obstacleTimer = 0;
    const obstacleInterval = 100;

    function drawDino() {
      if (!ctx) {
        return;
      }
      ctx.fillStyle = "#333";
      ctx.fillRect(dino.x, dino.y, dino.width, dino.height);
      ctx.fillStyle = "#fff";
      ctx.fillRect(dino.x + 25, dino.y + 5, 5, 5);
      ctx.fillStyle = "#333";
      ctx.fillRect(dino.x - 10, dino.y + 20, 10, 10);
    }

    function drawObstacles() {
      if (!ctx) {
        return;
      }
      obstacles.forEach((obstacle) => {
        ctx.fillStyle = "#333";
        ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
      });
    }

    function drawGround() {
      if (!ctx) {
        return;
      }
      ctx.fillStyle = "#333";
      ctx.fillRect(0, rect.height - 20, rect.width, 2);
    }

    function drawScore() {
      if (!ctx) {
        return;
      }
      ctx.fillStyle = "#666";
      ctx.font = "16px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(`${Math.floor(gameScore)}`, rect.width - 20, 40);
    }

    function drawGameOver() {
      if (!ctx) {
        return;
      }
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.fillRect(0, 0, rect.width, rect.height);

      ctx.fillStyle = "#fff";
      ctx.font = "bold 28px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("游戏结束", rect.width / 2, rect.height / 2 - 20);
      ctx.font = "18px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      ctx.fillText(`最终分数: ${Math.floor(gameScore)}`, rect.width / 2, rect.height / 2 + 30);
      ctx.fillText("点击重新开始", rect.width / 2, rect.height / 2 + 70);
    }

    function update() {
      if (!ctx) {
        return;
      }
      if (gameOver) {
        drawGameOver();
        return;
      }

      ctx.clearRect(0, 0, rect.width, rect.height);

      dino.dy += dino.gravity;
      dino.y += dino.dy;

      if (dino.y > rect.height - 60) {
        dino.y = rect.height - 60;
        dino.dy = 0;
        dino.isJumping = false;
      }

      obstacleTimer++;
      if (obstacleTimer > obstacleInterval) {
        const height = 30 + Math.random() * 20;
        obstacles.push({
          x: rect.width,
          y: rect.height - 20 - height,
          width: 20 + Math.random() * 10,
          height: height,
          speed: 5 + gameScore * 0.01,
        });
        obstacleTimer = 0;
      }

      obstacles.forEach((obstacle, index) => {
        obstacle.x -= obstacle.speed;

        if (obstacle.x + obstacle.width < 0) {
          obstacles.splice(index, 1);
        }

        if (
          dino.x < obstacle.x + obstacle.width &&
          dino.x + dino.width > obstacle.x &&
          dino.y < obstacle.y + obstacle.height &&
          dino.y + dino.height > obstacle.y
        ) {
          gameOver = true;
        }
      });

      gameScore += 0.1;
      setScore(gameScore);

      drawGround();
      drawDino();
      drawObstacles();
      drawScore();

      animationFrameId = requestAnimationFrame(update);
    }

    function jump() {
      if (gameOver) {
        onRestart?.();
        return;
      }

      if (!dino.isJumping) {
        dino.dy = -dino.jumpForce;
        dino.isJumping = true;
      }
    }

    function startGame() {
      update();
    }

    init();
    startGame();

    function init() {
      if (!ctx) {
        return;
      }
      ctx.clearRect(0, 0, rect.width, rect.height);
      drawGround();
      drawDino();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        jump();
      }
    };

    const handleClick = () => {
      jump();
    };

    const handleResize = () => {
      const newRect = container.getBoundingClientRect();
      canvas.width = newRect.width * dpr;
      canvas.height = newRect.height * dpr;
      canvas.style.width = `${newRect.width}px`;
      canvas.style.height = `${newRect.height}px`;
      ctx.scale(dpr, dpr);
      dino.y = newRect.height - 60;
    };

    window.addEventListener("keydown", handleKeyDown);
    canvas.addEventListener("click", handleClick);
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("keydown", handleKeyDown);
      canvas.removeEventListener("click", handleClick);
      window.removeEventListener("resize", handleResize);
    };
  }, [onRestart]);

  return (
    <div ref={containerRef} className="game-container">
      <canvas ref={canvasRef} />
      <div className="game-info">
        <span className="score">{Math.floor(score)}</span>
      </div>
    </div>
  );
}
