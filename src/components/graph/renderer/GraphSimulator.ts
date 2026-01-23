import * as d3 from 'd3';
import { PixiRenderer } from './PixiRenderer';
import { createRenderedNode } from './NodeRenderer';
import { renderLink } from './LinkRenderer';
import { getNodeRadius, getNodeDistanceFromCenter, calculateNodeAlpha } from '../utils/graphHelpers';
import type { GraphConfig, NodeData, LinkData, GraphThemeColors, RenderedNode, RenderedLink } from '../types/graph.types';
import { Graphics } from 'pixi.js';

export class GraphSimulator {
    private renderer: PixiRenderer;
    private simulation: d3.Simulation<NodeData, LinkData> | null = null;
    private renderedNodes: RenderedNode[] = [];
    private renderedLinks: RenderedLink[] = [];
    private theme: GraphThemeColors;
    private config: GraphConfig;
    private centerId: string;
    private onNodeClick?: (nodeId: string) => void;
    private isDragging: boolean = false;
    private hasDragged: boolean = false;
    private pendingHoverId: string | null = null;
    private hoveredNodeId: string | null = null;
    private ticker: ((delta: any) => void) | null = null;
    private viewMode: 'focus' | 'full' = 'focus';

    constructor(
        renderer: PixiRenderer,
        theme: GraphThemeColors,
        config: GraphConfig,
        centerId: string,
        onNodeClick?: (nodeId: string) => void
    ) {
        this.renderer = renderer;
        this.theme = theme;
        this.config = config;
        this.centerId = centerId;
        this.onNodeClick = onNodeClick;
    }

    public init(nodes: NodeData[], links: LinkData[], width: number, height: number, viewMode: 'focus' | 'full') {
        // Clear previous
        this.renderer.linkContainer!.removeChildren();
        this.renderer.nodeContainer!.removeChildren();
        this.renderer.labelContainer!.removeChildren();

        // Setup Simulation
        // Pre-calculate connected nodes for performance
        const connectedNodeIds = new Set<string>();
        links.forEach(l => {
            const sid = typeof l.source === 'object' ? l.source.id : l.source as string;
            const tid = typeof l.target === 'object' ? l.target.id : l.target as string;
            connectedNodeIds.add(sid);
            connectedNodeIds.add(tid);
        });

        // Setup Simulation
        this.simulation = d3.forceSimulation<NodeData, LinkData>(nodes)
            .force("charge", d3.forceManyBody().strength((n: any) => {
                const isConnected = connectedNodeIds.has(n.id);
                return isConnected ? -30 * this.config.repelForce : -1 * this.config.repelForce;
            }))
            .force("center", d3.forceCenter(width / 2, height / 2).strength(this.config.centerForce))
            .force("x", d3.forceX(width / 2).strength(0.02))
            .force("y", d3.forceY(height / 2).strength(0.02))
            .force("link", d3.forceLink<NodeData, LinkData>(links).id(d => d.id).distance(this.config.linkDistance))
            .force("collide", d3.forceCollide<NodeData>((n) => {
                const r = getNodeRadius(n, links);
                // Estimate text radius (half width) to prevent overlapping titles
                // Assumes average char width is roughly 0.6 * fontSize
                const textWidth = (n.text?.length || 0) * this.config.fontSize * 0.6;
                // Use a hybrid radius: we don't want it FULL width (too sparse), but enough to reduce clash
                return Math.max(r * 1.5, textWidth / 2.2);
            }).iterations(3));

        this.simulation.stop(); // Stop internal timer

        // Create Render Objects
        this.renderedLinks = links.map(link => {
            const graphics = new Graphics();
            this.renderer.linkContainer!.addChild(graphics);

            // Calculate Base Alpha (Default state)
            const dist = Math.min(
                getNodeDistanceFromCenter(typeof link.source === 'object' ? link.source.id : link.source as string, links, this.centerId),
                getNodeDistanceFromCenter(typeof link.target === 'object' ? link.target.id : link.target as string, links, this.centerId)
            );
            let baseAlpha = Math.max(0.1, calculateNodeAlpha(dist) - 0.2);
            if (link.linkType === 'tag') baseAlpha = Math.max(baseAlpha, 0.3);

            const initialAlpha = baseAlpha; // Start at base alpha

            return {
                data: link,
                graphics,
                color: link.linkType === 'tag' ? this.theme.linkTag : this.theme.link,
                alpha: initialAlpha,
                targetAlpha: initialAlpha,
                baseAlpha: baseAlpha
            };
        });

        this.renderedNodes = nodes.map(node => {
            const radius = getNodeRadius(node, links);
            const color = node.nodeType === 'tag' ? this.theme.nodeTag : (node.isCurrent ? this.theme.nodeCurrent : (node.isVisited ? this.theme.nodeVisited : this.theme.nodeDefault));
            const rendered = createRenderedNode(node, radius, color, this.theme, { fontSize: this.config.fontSize });

            this.renderer.nodeContainer!.addChild(rendered.graphics);
            this.renderer.labelContainer!.addChild(rendered.label);

            rendered.graphics.on('pointerover', () => this.updateHoverState(node.id));
            rendered.graphics.on('pointerleave', () => this.updateHoverState(null));
            rendered.graphics.on('click', () => {
                if (this.hasDragged) return;
                if (this.onNodeClick) this.onNodeClick(node.id);
                else if (node.nodeType === 'article' || node.nodeType === 'tag') window.location.href = node.id;
            });

            // Calculate Base Alpha
            let baseAlpha = 1;
            if (viewMode === 'full') {
                baseAlpha = 1;
            } else {
                const dist = getNodeDistanceFromCenter(node.id, links, this.centerId);
                baseAlpha = calculateNodeAlpha(dist);
            }

            return {
                ...rendered,
                alpha: baseAlpha, // Start at base alpha
                targetAlpha: baseAlpha,
                baseAlpha: baseAlpha
            };
        });

        // Setup Drag
        if (this.config.drag) {
            this.setupDrag(this.renderer.app!.canvas);
        }

        // Setup Zoom
        if (this.config.zoom) {
            const zoom = d3.zoom<HTMLCanvasElement, unknown>()
                .scaleExtent([0.1, 4])
                .on('zoom', (event) => {
                    const { k, x, y } = event.transform;
                    this.renderer.app!.stage.scale.set(k);
                    this.renderer.app!.stage.position.set(x, y);
                });
            d3.select(this.renderer.app!.canvas).call(zoom);
        }

        // Setup Ticker
        this.ticker = (delta: any) => this.tick(delta);
        this.renderer.app!.ticker.add(this.ticker);

        // Initial Hover Calculation already handled by init logic above (setting targetAlpha = baseAlpha)
        // But we call updateHoverState(null) to ensure consistency just in case
        // this.updateHoverState(null, links, viewMode); 
        // Actually, updateHoverState is simplified now, so calling it is fine.
        this.updateHoverState(null);
    }

    public updateConfig(newConfig: GraphConfig, currentLinks: LinkData[]) {
        this.config = newConfig;
        if (!this.simulation || !this.renderer.app) return;

        const connectedNodeIds = new Set<string>();
        currentLinks.forEach(l => {
            const sid = typeof l.source === 'object' ? l.source.id : l.source as string;
            const tid = typeof l.target === 'object' ? l.target.id : l.target as string;
            connectedNodeIds.add(sid);
            connectedNodeIds.add(tid);
        });

        this.simulation.force("charge", d3.forceManyBody().strength((n: any) => {
            const isConnected = connectedNodeIds.has(n.id);
            return isConnected ? -30 * this.config.repelForce : -1 * this.config.repelForce;
        }));
        this.simulation.force("center", d3.forceCenter(this.renderer.app.screen.width / 2, this.renderer.app.screen.height / 2).strength(this.config.centerForce));
        this.simulation.force("x", d3.forceX(this.renderer.app.screen.width / 2).strength(0.02));
        this.simulation.force("y", d3.forceY(this.renderer.app.screen.height / 2).strength(0.02));
        this.simulation.force("link", d3.forceLink<NodeData, LinkData>(currentLinks).id(d => d.id).distance(this.config.linkDistance));
        this.simulation.alpha(0.3).restart();
    }

    public updateCenter(width: number, height: number) {
        if (this.simulation) {
            const centerForce = this.simulation.force("center") as d3.ForceCenter<NodeData>;
            if (centerForce) {
                centerForce.x(width / 2);
                centerForce.y(height / 2);
            }
            this.simulation.alpha(0.3).restart();
        }
    }

    public destroy() {
        if (this.ticker && this.renderer.app) {
            this.renderer.app.ticker.remove(this.ticker);
        }
        if (this.simulation) {
            this.simulation.stop();
        }
    }

    private setupDrag(canvas: HTMLCanvasElement) {
        d3.select(canvas)
            .call(d3.drag<HTMLCanvasElement, unknown>()
                .container(canvas)
                .subject(event => {
                    const transform = d3.zoomTransform(canvas);
                    const rect = canvas.getBoundingClientRect();
                    const x = transform.invertX(event.sourceEvent.clientX - rect.left);
                    const y = transform.invertY(event.sourceEvent.clientY - rect.top);
                    const node = this.simulation?.find(x, y, 30);
                    if (node) {
                        node.x = node.x ?? 0;
                        node.y = node.y ?? 0;
                        return node;
                    }
                    return undefined;
                })
                .on("start", (event) => {
                    this.isDragging = true;
                    this.hasDragged = false;
                    if (!event.active) this.simulation?.alphaTarget(0.3);
                    const transform = d3.zoomTransform(canvas);
                    const rect = canvas.getBoundingClientRect();
                    const startX = transform.invertX(event.sourceEvent.clientX - rect.left);
                    const startY = transform.invertY(event.sourceEvent.clientY - rect.top);
                    event.subject.fx = startX;
                    event.subject.fy = startY;
                })
                .on("drag", (event) => {
                    const transform = d3.zoomTransform(canvas);
                    const rect = canvas.getBoundingClientRect();
                    const x = transform.invertX(event.sourceEvent.clientX - rect.left);
                    const y = transform.invertY(event.sourceEvent.clientY - rect.top);
                    this.hasDragged = true;
                    event.subject.fx = x;
                    event.subject.fy = y;
                })
                .on("end", (event) => {
                    if (!event.active) this.simulation?.alphaTarget(0);
                    this.isDragging = false;
                    if (this.pendingHoverId !== this.hoveredNodeId) {
                        this.updateHoverState(this.pendingHoverId);
                    }
                    setTimeout(() => { this.hasDragged = false; }, 50);
                    event.subject.fx = null;
                    event.subject.fy = null;
                }) as any
            );
    }

    private tick(delta: any) {
        this.simulation?.tick();

        this.renderedLinks.forEach(link => {
            link.alpha += (link.targetAlpha - link.alpha) * 0.1;
            renderLink(link.graphics, link.data.source, link.data.target, {
                color: link.color,
                alpha: link.alpha,
                linkType: link.data.linkType
            });
        });

        this.renderedNodes.forEach(node => {
            node.alpha += (node.targetAlpha - node.alpha) * 0.1;
            const { x, y } = node.data;
            if (x != null && y != null) {
                node.graphics.position.set(x, y);
                node.label.position.set(x, y);
                node.graphics.alpha = node.alpha;
                node.label.alpha = node.alpha;
            }
        });
    }

    private updateHoverState(newHoverId: string | null) {
        this.hoveredNodeId = newHoverId;
        this.pendingHoverId = newHoverId;

        if (!this.config.focusOnHover || this.isDragging) return;

        const focusNode = newHoverId ?? this.centerId;
        const isHovering = !!newHoverId;

        // Use pre-calculated baseAlpha instead of expensive BFS
        if (!isHovering) {
            this.renderedLinks.forEach(link => {
                link.targetAlpha = link.baseAlpha;
            });
            this.renderedNodes.forEach(node => {
                node.targetAlpha = node.baseAlpha;
            });
            return;
        }

        // If hovering, we still need to check connectivity, but that's cheaper
        // (O(E) linear scan, no recursion)

        // Need to construct adjacency set or just filter (filter is O(E) per node, actually O(V*E) total if we do nested... wait)

        // The original logic:
        // this.renderedLinks.forEach(link => {
        //     const sourceId = typeof link.data.source === 'object' ? link.data.source.id : link.data.source;
        //     const targetId = typeof link.data.target === 'object' ? link.data.target.id : link.data.target;
        //     const isConnected = sourceId === focusNode || targetId === focusNode;

        //     link.targetAlpha = isConnected ? 1 : 0.1;
        // });

        // this.renderedNodes.forEach(node => {
        //      // For nodes, we check if they are neighbors of focusNode
        //      // We can leverage the links loop result implicitly or do another loop

        //      // To be efficient:
        //      // 1. Collect neighbors of focusNode
        //      // 2. Set alpha

        //      // But following original logic:
        //      // It iterates all links per node... O(V*E). Bad.
        //      // We should optimize this too.

        //      // Optimized approach:
        //      // Build set of neighbor IDs first.
        // });

        const neighborIds = new Set<string>();
        neighborIds.add(focusNode);

        this.renderedLinks.forEach(link => {
            const s = typeof link.data.source === 'object' ? link.data.source.id : link.data.source as string;
            const t = typeof link.data.target === 'object' ? link.data.target.id : link.data.target as string;

            if (s === focusNode) neighborIds.add(t);
            if (t === focusNode) neighborIds.add(s);

            const isConnected = s === focusNode || t === focusNode;
            link.targetAlpha = isConnected ? 1 : 0.1;
        });

        this.renderedNodes.forEach(node => {
            node.targetAlpha = neighborIds.has(node.data.id) ? 1 : 0.1;
        });
    }
}
