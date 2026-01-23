import type { NodeData, LinkData, GraphThemeColors } from '../types/graph.types';

export function normalizePermalink(permalink: string): string {
    const trimmed = permalink.trim();
    if (trimmed === "" || trimmed === "/") return "/";
    const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    return withLeadingSlash.endsWith("/") ? withLeadingSlash.slice(0, -1) : withLeadingSlash;
}

export function getCurrentPermalink(): string {
    if (typeof window === 'undefined') return '/';
    return normalizePermalink(window.location.pathname);
}

export function getCurrentOrPropPermalink(currentPermalink?: string): string {
    if (currentPermalink == null) return getCurrentPermalink();
    return normalizePermalink(currentPermalink);
}

export function getNodeColor(node: NodeData, theme: GraphThemeColors): string {
    if (node.nodeType === 'tag') {
        return theme.nodeTag;
    }
    if (node.isCurrent) {
        return theme.nodeCurrent;
    }
    if (node.isVisited) {
        return theme.nodeVisited;
    }
    return theme.nodeDefault;
}

export function getNodeRadius(node: NodeData, links: LinkData[]): number {
    const numLinks = links.filter(
        (l) => l.source.id === node.id || l.target.id === node.id,
    ).length;

    // Tag 节点大小逻辑：关联越多越大
    const baseRadius = node.nodeType === 'tag' ? 4 : 3;
    // 系数可以让 tag 增长得更明显
    const growthFactor = node.nodeType === 'tag' ? 1.2 : 0.8;
    // 设置上限
    const maxRadius = node.nodeType === 'tag' ? 15 : 10;

    return Math.min(baseRadius + Math.sqrt(numLinks) * growthFactor * 3, maxRadius);
}

export function getNodeDistanceFromCenter(
    nodeId: string,
    links: LinkData[],
    centerId: string
): number {
    if (nodeId === centerId) return 0;

    const visited = new Set<string>([centerId]);
    const queue: string[] = [centerId];
    let distance = 0;

    while (queue.length > 0) {
        const levelSize = queue.length;
        distance++;

        for (let i = 0; i < levelSize; i++) {
            const current = queue.shift()!;

            for (const link of links) {
                let neighbor: string | null = null;
                if (link.source.id === current) neighbor = link.target.id;
                if (link.target.id === current) neighbor = link.source.id;

                if (neighbor && neighbor === nodeId) return distance;
                if (neighbor && !visited.has(neighbor)) {
                    visited.add(neighbor);
                    queue.push(neighbor);
                }
            }
        }
    }

    return Infinity;
}

export function calculateNodeAlpha(distance: number): number {
    // 线性衰减：距离每增加1，alpha减少0.15，最低0.05
    if (distance === 0) return 1;
    if (distance === Infinity) return 0;

    const alpha = 1 - (distance * 0.15);
    return Math.max(0.05, alpha);
}

export function getNeighborhood(
    nodes: NodeData[],
    links: LinkData[],
    centerId: string,
    depth: number,
): Set<string> {
    // If depth is Infinity, return all nodes
    if (!Number.isFinite(depth)) {
        return new Set(nodes.map((n) => n.id));
    }

    const neighborhood = new Set<string>();
    const queue: (string | "__SENTINEL__")[] = [centerId, "__SENTINEL__"];

    let currentDepth = 0;
    while (queue.length > 0) {
        const current = queue.shift()!;
        if (current === "__SENTINEL__") {
            currentDepth++;
            if (currentDepth < depth) {
                queue.push("__SENTINEL__");
            }
        } else {
            neighborhood.add(current);

            if (currentDepth < depth) {
                const outgoing = links.filter((l) => l.source.id === current);
                const incoming = links.filter((l) => l.target.id === current);

                for (const link of outgoing) {
                    if (!neighborhood.has(link.target.id)) {
                        queue.push(link.target.id);
                    }
                }
                for (const link of incoming) {
                    if (!neighborhood.has(link.source.id)) {
                        queue.push(link.source.id);
                    }
                }
            }
        }
    }
    return neighborhood;
}
