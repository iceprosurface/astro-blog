# 404 游戏系统

## 架构说明

404 页面的游戏系统采用模块化设计，支持多个小游戏随机展示。

### 目录结构

```
src/
├── config/
│   └── games.ts           # 游戏配置文件（注册所有游戏）
├── components/games/
│   ├── GameManager.tsx    # 游戏管理器（负责游戏切换和随机选择）
│   └── DinoGame.tsx       # 恐龙游戏组件（示例游戏）
└── pages/
    └── 404.astro          # 404 页面（使用 GameManager）
```

## 添加新游戏

### 步骤 1: 创建游戏组件

在 `src/components/games/` 下创建新的游戏组件（如 `SnakeGame.tsx`）：

```tsx
import { useEffect, useRef, useState } from "react";

interface GameProps {
  className?: string;
}

export default function YourGame({ className = "" }: GameProps) {
  // 实现游戏逻辑
  return (
    <div className={`game-container ${className}`}>
      {/* 游戏内容 */}
    </div>
  );
}
```

### 步骤 2: 在配置文件中注册游戏

在 `src/config/games.ts` 的 `GAMES` 数组中添加游戏配置：

```typescript
export const GAMES: GameConfig[] = [
  // ... 现有游戏
  {
    id: "snake",
    name: "贪吃蛇",
    description: "经典的贪吃蛇游戏",
    component: "SnakeGame",
  },
];
```

### 步骤 3: 在 GameManager 中添加游戏渲染逻辑

在 `src/components/games/GameManager.tsx` 的 `renderGame()` 函数中添加新游戏：

```typescript
const renderGame = () => {
  if (!currentGame) return null;

  switch (currentGame.component) {
    case "DinoGame":
      return <DinoGame />;
    case "SnakeGame":
      return <SnakeGame />;
    default:
      return null;
  }
};
```

### 步骤 4: 导入游戏组件

在 `GameManager.tsx` 顶部导入新游戏组件：

```typescript
import DinoGame from "./DinoGame";
import SnakeGame from "./SnakeGame";
```

## 功能特性

- **随机游戏**: 每次访问 404 页面，会随机选择一个游戏
- **游戏切换**: 点击"切换游戏"按钮可以选择不同的游戏
- **随机按钮**: 点击"随机游戏"按钮可以随机切换到另一个游戏
- **响应式设计**: 适配移动端和桌面端

## 开发建议

1. **游戏尺寸**: 建议游戏画布宽度为 800px，高度为 300px
2. **性能**: 使用 `requestAnimationFrame` 进行动画循环
3. **交互**: 支持键盘和鼠标/触摸交互
4. **清理**: 在 `useEffect` 的清理函数中取消动画帧和移除事件监听器

## 示例游戏

当前已实现的游戏：
- **恐龙快跑** (DinoGame): 躲避障碍物的小恐龙游戏
