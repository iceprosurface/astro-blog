import type { Graphics } from 'pixi.js';
import type { LinkType } from '../types/graph.types';

export function renderLink(
    graphics: Graphics,
    source: { x: number; y: number },
    target: { x: number; y: number },
    options: {
        color: string;
        alpha: number;
        linkType: LinkType;
        width?: number;
    }
) {
    graphics.clear();

    if (options.linkType === 'tag') {
        drawDashedLine(graphics, source, target, {
            color: options.color,
            alpha: Math.min(options.alpha + 0.3, 1), // Tag links slightly more visible otherwise distinct
            dashLength: 3,
            gapLength: 3,
            width: options.width ?? 1,
        });
    } else {
        graphics
            .moveTo(source.x, source.y)
            .lineTo(target.x, target.y)
            .stroke({
                alpha: options.alpha,
                width: options.width ?? 1,
                color: options.color
            });
    }
}

function drawDashedLine(
    graphics: Graphics,
    start: { x: number; y: number },
    end: { x: number; y: number },
    options: {
        color: string;
        alpha: number;
        dashLength: number;
        gapLength: number;
        width: number;
    }
) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance === 0) return;

    const unitX = dx / distance;
    const unitY = dy / distance;

    const { dashLength, gapLength } = options;
    const segmentLength = dashLength + gapLength;

    let currentPos = 0;

    while (currentPos < distance) {
        const segmentEnd = Math.min(currentPos + dashLength, distance);

        graphics
            .moveTo(
                start.x + unitX * currentPos,
                start.y + unitY * currentPos
            )
            .lineTo(
                start.x + unitX * segmentEnd,
                start.y + unitY * segmentEnd
            );

        currentPos += segmentLength;
    }

    graphics.stroke({
        alpha: options.alpha,
        width: options.width,
        color: options.color,
    });
}
