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
    private hoverIntensity: number = 0; // 0 to 1, smoothed
    private ticker: ((delta: any) => void) | null = null;
    private viewMode: 'focus' | 'full' = 'focus';
    // Use any[] to handle d3's mutation of source/target from string ID to Node object
    private simLinks: any[] = [];
    private currentScale: number = 1;
    private frameCounter: number = 0;

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
        // Clone data to avoid shared state issues between instances (Sidebar vs Full)
        const simNodes = nodes.map(n => ({ ...n }));
        this.simLinks = links.map(l => ({
            ...l,
            source: typeof l.source === 'object' ? (l.source as any).id : l.source,
            target: typeof l.target === 'object' ? (l.target as any).id : l.target
        }));

        // Initial Layout: Spiral / Phyllotaxis to prevent explosion
        // This spreads nodes out initially so they don't start at (0,0) and repel violently
        simNodes.forEach((node, i) => {
            const n = node as any;
            if (n.id === this.centerId) {
                n.x = width / 2;
                n.y = height / 2;
                return;
            }
            // Spiral arrangement
            const angle = i * 0.5; // Arbitrary angle increment
            const radius = 30 + 10 * i; // Increasing radius
            // Randomize slightly to avoid perfect lines
            n.x = width / 2 + radius * Math.cos(angle);
            n.y = height / 2 + radius * Math.sin(angle);
        });

        // Pre-calculate connected nodes for performance
        const connectedNodeIds = new Set<string>();
        this.simLinks.forEach(l => {
            // source/target are strings now after cloning
            const sid = l.source as string;
            const tid = l.target as string;
            connectedNodeIds.add(sid);
            connectedNodeIds.add(tid);
        });

        // Setup Simulation
        this.simulation = d3.forceSimulation<NodeData, LinkData>(simNodes)
            .force("charge", d3.forceManyBody().strength((n: any) => {
                const isConnected = connectedNodeIds.has(n.id);
                return isConnected ? -15 * this.config.repelForce : -5 * this.config.repelForce;
            }))
            .force("center", d3.forceCenter(width / 2, height / 2).strength(this.config.centerForce))
            .force("x", d3.forceX(width / 2).strength(0.05))
            .force("y", d3.forceY(height / 2).strength(0.05))
            .force("link", d3.forceLink<NodeData, LinkData>(this.simLinks).id(d => d.id).distance(this.config.linkDistance).strength(0.2))
            .force("collide", d3.forceCollide<NodeData>((n) => {
                const r = getNodeRadius(n, links);
                // Estimate text radius (half width) to prevent overlapping titles
                // Assumes average char width is roughly 0.6 * fontSize
                const textWidth = (n.text?.length || 0) * this.config.fontSize * 0.6;
                // Use a hybrid radius: we don't want it FULL width (too sparse), but enough to reduce clash
                return Math.max(r * 1.2, textWidth / 4);
            }).iterations(2))
            .velocityDecay(0.6)
            .alphaMin(0.05)
            .alphaDecay(0.03);

        // Fix the center node to the screen center initially
        const centerNode = simNodes.find(n => n.id === this.centerId) as any;
        if (centerNode) {
            centerNode.fx = width / 2;
            centerNode.fy = height / 2;
            centerNode.x = width / 2;
            centerNode.y = height / 2;
        }

        // Create Render Objects
        this.renderedLinks = this.simLinks.map(link => {
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

        this.renderedNodes = simNodes.map(node => {
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

            // Calculate link count for progressive disclosure
            const linkCount = this.simLinks.filter((l: any) => {
                const s = typeof l.source === "object" ? l.source.id : l.source;
                const t = typeof l.target === "object" ? l.target.id : l.target;
                return s === node.id || t === node.id;
            }).length;

            return {
                ...rendered,
                alpha: baseAlpha, // Start at base alpha
                targetAlpha: baseAlpha,
                baseAlpha: baseAlpha,
                linkCount: linkCount
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
                    console.log('[GraphSimulator] Zoom event:', { scale: k, x, y });
                    this.currentScale = k;
                    this.renderer.app!.stage.scale.set(k);
                    this.renderer.app!.stage.position.set(x, y);
                });
            d3.select(this.renderer.app!.canvas).call(zoom);
            // Get initial scale from current transform
            const initialTransform = d3.zoomTransform(this.renderer.app!.canvas);
            this.currentScale = initialTransform.k;
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
        // Use internally managed simLinks instead of external currentLinks
        // to ensure compatibility with simNodes in the simulation
        const linksToUse = this.simLinks.length > 0 ? this.simLinks : currentLinks;

        linksToUse.forEach(l => {
            const sid = typeof l.source === 'object' ? l.source.id : l.source as string;
            const tid = typeof l.target === 'object' ? l.target.id : l.target as string;
            connectedNodeIds.add(sid);
            connectedNodeIds.add(tid);
        });

        this.simulation.force("charge", d3.forceManyBody().strength((n: any) => {
            const isConnected = connectedNodeIds.has(n.id);
            return isConnected ? -15 * this.config.repelForce : -5 * this.config.repelForce;
        }));
        this.simulation.force("center", d3.forceCenter(this.renderer.app.screen.width / 2, this.renderer.app.screen.height / 2).strength(this.config.centerForce));
        this.simulation.force("x", d3.forceX(this.renderer.app.screen.width / 2).strength(0.05));
        this.simulation.force("y", d3.forceY(this.renderer.app.screen.height / 2).strength(0.05));
        this.simulation.force("link", d3.forceLink<NodeData, LinkData>(linksToUse).id(d => d.id).distance(this.config.linkDistance).strength(0.2));
        this.simulation.alpha(0.3).restart();
    }

    public updateCenter(width: number, height: number) {
        if (this.simulation) {
            const centerForce = this.simulation.force("center") as d3.ForceCenter<NodeData>;
            if (centerForce) {
                centerForce.x(width / 2);
                centerForce.y(height / 2);
            }

            // Also update the fixed position of the center node if it's still pinned
            const centerNode = this.simulation.nodes().find((n: NodeData) => n.id === this.centerId) as any;
            if (centerNode && centerNode.fx !== null && centerNode.fx !== undefined) {
                centerNode.fx = width / 2;
                centerNode.fy = height / 2;
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
                    this.updateHoverState(event.subject.id);
                    if (!event.active) this.simulation?.alphaTarget(0.3).restart();
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
                    this.updateHoverState(null);
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

        if (!this.renderer.app) return;

        this.renderedLinks.forEach(link => {
            link.alpha += (link.targetAlpha - link.alpha) * 0.1;
            renderLink(link.graphics, link.data.source, link.data.target, {
                color: link.color,
                alpha: link.alpha,
                linkType: link.data.linkType
            });
        });

        const centerX = this.renderer.app.screen.width / 2;
        const centerY = this.renderer.app.screen.height / 2;
        const fadeRadius = 600; // Radius where fade starts to drop off

        // Global hover intensity interpolation (0 = no hover, 1 = hovering something)
        const targetHoverIntensity = this.hoveredNodeId !== null ? 1 : 0;
        this.hoverIntensity += (targetHoverIntensity - this.hoverIntensity) * 0.15;

        this.renderedNodes.forEach(node => {
            node.alpha += (node.targetAlpha - node.alpha) * 0.1;
            const { x, y } = node.data;
            if (x != null && y != null) {
                node.graphics.position.set(x, y);
                node.label.position.set(x, y);


                // Calculate separate scale-based opacities for node and label
                let nodeScaleOpacity = 1;
                let labelScaleOpacity = 1;

                // Get current scale directly from PixiJS stage
                const scale = this.renderer.app?.stage.scale.x ?? 1;
                const links = node.linkCount || 0;

                // 1. Node progressive disclosure (Smoothed Ramps)
                if (scale < 0.5) {
                    const t = scale / 0.5;
                    if (links >= 5) nodeScaleOpacity = 1;
                    else if (links >= 2) nodeScaleOpacity = 0.2 + t * 0.3; // 0.2 -> 0.5
                    else nodeScaleOpacity = 0.05 + t * 0.15; // 0.05 -> 0.2
                } else if (scale < 1.2) {
                    const t = (scale - 0.5) / 0.7;
                    if (links >= 2) nodeScaleOpacity = 0.5 + t * 0.5; // 0.5 -> 1.0
                    else if (links >= 1) nodeScaleOpacity = 0.2 + t * 0.6; // 0.2 -> 0.8
                    else nodeScaleOpacity = 0.2 + t * 0.3; // 0.2 -> 0.5
                } else if (scale < 2.0) {
                    const t = (scale - 1.2) / 0.8;
                    if (links >= 1) nodeScaleOpacity = 0.8 + t * 0.2; // 0.8 -> 1.0
                    else nodeScaleOpacity = 0.5 + t * 0.5; // 0.5 -> 1.0
                } else {
                    nodeScaleOpacity = 1;
                }

                // 2. Label progressive disclosure (Stricter, shows all at scale >= 2.5)
                if (scale < 0.6) {
                    // Show labels ONLY for major hubs
                    labelScaleOpacity = links >= 8 ? 1 : 0;
                } else if (scale < 1.2) {
                    // Show labels for nodes with >= 3 links, fade in >= 2
                    if (links >= 3) labelScaleOpacity = 1;
                    else if (links >= 2) labelScaleOpacity = (scale - 0.6) / 0.6; // 0 to 1
                    else labelScaleOpacity = 0;
                } else if (scale < 1.8) {
                    // Show labels for nodes with >= 2 links, fade in >= 1
                    if (links >= 2) labelScaleOpacity = 1;
                    else if (links >= 1) labelScaleOpacity = (scale - 1.2) / 0.6; // 0 to 1
                    else labelScaleOpacity = 0;
                } else if (scale < 2.5) {
                    // Show all connected labels, fade in isolated ones
                    if (links >= 1) labelScaleOpacity = 1;
                    else labelScaleOpacity = (scale - 1.8) / 0.7; // 0 to 1
                } else {
                    labelScaleOpacity = 1;
                }

                // 3. Smooth Highlight Logic (Avoid pops/flashes)
                // focusLevel represents how much this node is highlighted due to hover.
                // We multiply by this.hoverIntensity to ensure focusLevel is 0 when not hovering,
                // allowing default zoom-based hiding to work.
                const focusProgress = Math.max(0, Math.min(1, (node.alpha - 0.05) / 0.95));
                const focusLevel = this.hoverIntensity * focusProgress;

                // Mix scale-based disclosure with focus-state (1.0)
                const effectiveNodeScaleOpacity = nodeScaleOpacity + (1 - nodeScaleOpacity) * focusLevel;
                const effectiveLabelScaleOpacity = labelScaleOpacity + (1 - labelScaleOpacity) * focusLevel;

                const finalNodeOpacity = node.alpha * effectiveNodeScaleOpacity;
                const finalLabelOpacity = node.alpha * effectiveLabelScaleOpacity;

                node.graphics.alpha = finalNodeOpacity;
                node.label.alpha = finalLabelOpacity;
                node.label.visible = finalLabelOpacity > 0.005;
                node.label.tint = 0xFFFFFF;
            }
        });
    }

    private updateHoverState(newHoverId: string | null) {
        this.hoveredNodeId = newHoverId;
        this.pendingHoverId = newHoverId;

        // Allow updateHoverState to run even if isDragging is true, if called internally from drag handlers
        if (!this.config.focusOnHover && !this.isDragging) return;

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

        const neighborIds = new Set<string>();
        neighborIds.add(focusNode);

        this.renderedLinks.forEach(link => {
            const s = typeof link.data.source === 'object' ? link.data.source.id : link.data.source as string;
            const t = typeof link.data.target === 'object' ? link.data.target.id : link.data.target as string;

            if (s === focusNode) neighborIds.add(t);
            if (t === focusNode) neighborIds.add(s);

            const isConnected = s === focusNode || t === focusNode;
            link.targetAlpha = isConnected ? 1 : 0.05;
        });

        this.renderedNodes.forEach(node => {
            node.targetAlpha = neighborIds.has(node.data.id) ? 1 : 0.05;
        });
    }
}
