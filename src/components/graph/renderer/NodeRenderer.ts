import { Graphics, Text, Circle } from 'pixi.js';
import type { NodeData, RenderedNode, GraphThemeColors } from '../types/graph.types';

export function createRenderedNode(
    node: NodeData,
    radius: number,
    color: string,
    theme: GraphThemeColors,
    config: { fontSize: number },
    linkCount: number = 0
): RenderedNode {
    const graphics = new Graphics({
        interactive: true,
        eventMode: "static",
        hitArea: new Circle(0, 0, Math.max(radius, 5)),
        cursor: "pointer",
        label: node.id, // Debug label
    });

    // Draw Circle
    graphics
        .circle(0, 0, radius)
        .fill({ color })
        .stroke({ width: 2, color: theme.background });

    // Node Type Specific Styles?
    // Tag nodes might have different visual styles besides color/size if desired in future

    const label = new Text({
        interactive: false,
        eventMode: "none",
        text: node.text,
        anchor: { x: 0.5, y: 1.5 }, // Slightly above the node
        style: {
            fontSize: config.fontSize,
            fill: theme.label,
            fontFamily: "PingFang SC, Microsoft YaHei, -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: node.nodeType === 'tag' ? 'bold' : 'normal',
        },
        resolution: (typeof window !== 'undefined' ? window.devicePixelRatio : 1) * 2, // Double resolution for sharpness especially during zoom
    });

    return {
        data: node,
        graphics,
        label,
        color,
        alpha: 1,
        targetAlpha: 1,
        baseAlpha: 1,
        linkCount,
    };
}
