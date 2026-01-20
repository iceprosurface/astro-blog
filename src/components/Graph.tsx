import { useEffect, useRef, useState } from 'react';
import * as d3 from "d3";
import { Application, Graphics, Text, Container, Circle } from "pixi.js";
import { createPortal } from 'react-dom';
import './Graph.css';

type GraphThemeColors = {
  background: string;
  link: string;
  label: string;
  nodeCurrent: string;
  nodeVisited: string;
  nodeDefault: string;
};

function getGraphThemeColors(): GraphThemeColors {
  const style = getComputedStyle(document.documentElement);
  return {
    background: style.getPropertyValue('--graph-bg').trim() || '#f8fafc',
    link: style.getPropertyValue('--graph-link').trim() || '#cbd5e1',
    label: style.getPropertyValue('--graph-label').trim() || '#1e293b',
    nodeCurrent: style.getPropertyValue('--graph-node-current').trim() || '#e11d48',
    nodeVisited: style.getPropertyValue('--graph-node-visited').trim() || '#0891b2',
    nodeDefault: style.getPropertyValue('--graph-node-default').trim() || '#64748b',
  };
}


// Type definitions
type NodeData = d3.SimulationNodeDatum & {
  id: string;
  text: string;
  isCurrent: boolean;
  isVisited: boolean;
};

type LinkData = d3.SimulationLinkDatum<NodeData> & {
  source: NodeData;
  target: NodeData;
};

type RenderedNode = {
  data: NodeData;
  graphics: Graphics;
  label: Text;
  color: string;
  alpha: number;
};

type RenderedLink = {
  data: LinkData;
  graphics: Graphics;
  color: string;
  alpha: number;
};

interface GraphProps {
  currentPermalink?: string;
}

// Graph configuration
const CONFIG = {
  drag: true,
  zoom: true,
  depth: 1,
  scale: 1.2,
  repelForce: 1.2,
  centerForce: 0.3,
  linkDistance: 60,
  fontSize: 10,
  opacityScale: 3,
  focusOnHover: true,
};

function FullGraphModal({
  isOpen,
  onClose,
  themeVersion,
  currentPermalink,
}: {
  isOpen: boolean;
  onClose: () => void;
  themeVersion: number;
  currentPermalink?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<'focus' | 'full'>('focus');

  useEffect(() => {
    if (isOpen && containerRef.current) {
      renderFullGraph(containerRef.current, getCurrentOrPropPermalink(currentPermalink), viewMode);
    }
  }, [isOpen, themeVersion, viewMode]);

  if (!isOpen) return null;

  return createPortal(
    <div className="graph-modal active" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        <div className="modal-header">
          <div className="modal-header-controls">
            <div
              className="mode-toggle-container"
              onClick={(e) => {
                e.stopPropagation();
                setViewMode(viewMode === 'focus' ? 'full' : 'focus');
              }}
            >
              <span className={`mode-label mode-label-focus ${viewMode === 'focus' ? 'active' : ''}`}>专注</span>
              <div className="mode-toggle-switch">
                <div className={`toggle-slider ${viewMode}`}></div>
              </div>
              <span className={`mode-label mode-label-full ${viewMode === 'full' ? 'active' : ''}`}>全图</span>
            </div>
            <button className="modal-close-btn" onClick={onClose}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>
        <div className="modal-body">
          <div ref={containerRef} className="full-graph-container"></div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Render full graph with all nodes
async function renderFullGraph(container: HTMLDivElement, currentId: string, viewMode: 'focus' | 'full' = 'focus') {
  if (!container) return;

  // Clear previous graph
  container.innerHTML = "";

  const { nodes: allNodes, links: allLinks } = await getGraphData(currentId);

  const theme = getGraphThemeColors();

  const nodes = allNodes;
  const links = allLinks;

  const currentNode = nodes.find((n) => n.id === currentId);
  if (currentNode) {
    currentNode.fx = 0;
    currentNode.fy = 0;
  }

  // Create D3 force simulation with adjusted parameters for larger graph
  const simulation = d3
    .forceSimulation<NodeData>(nodes)
    .force("charge", d3.forceManyBody().strength(-50))
    .force("center", d3.forceCenter(0, 0).strength(0.5))
    .force("link", d3.forceLink(links).distance(80))
    .force(
      "collide",
      d3.forceCollide<NodeData>((n) => getNodeRadius(n, links)).iterations(2),
    );

  // Initialize Pixi.js application
  const width = container.offsetWidth;
  const height = container.offsetHeight;
  const dpr = window.devicePixelRatio || 1;

  const app = new Application();
  await app.init({
    width,
    height,
    antialias: true,
    autoStart: false,
    resolution: dpr,
    backgroundAlpha: 0,
    resizeTo: container,
  });

  container.appendChild(app.canvas);
  app.canvas.style.width = "100%";
  app.canvas.style.height = "100%";

  const stage = app.stage;
  stage.interactive = false;
  stage.position.set(width / 2, height / 2);

  // Containers for layers
  const linkContainer = new Container<Graphics>({ zIndex: 1 });
  const nodeContainer = new Container<Graphics>({ zIndex: 2 });
  const labelContainer = new Container<Text>({ zIndex: 3 });
  stage.addChild(linkContainer, nodeContainer, labelContainer);

  // Render links
  const renderedLinks: RenderedLink[] = [];
  for (const link of links) {
    const graphics = new Graphics({ interactive: false, eventMode: "none" });
    linkContainer.addChild(graphics);

    renderedLinks.push({
      data: link,
      graphics,
      color: theme.link,
      alpha: 0.6,
    });
  }

    // Render nodes
    const renderedNodes: RenderedNode[] = [];
    const centerId = currentNode?.id || '';

    for (const node of nodes) {
      const radius = getNodeRadius(node, links);
      const color = getNodeColor(node, theme);
      const distance = getNodeDistanceFromCenter(node.id, links, centerId);

      const graphics = new Graphics({
        interactive: true,
        eventMode: "static",
        hitArea: new Circle(0, 0, radius),
        cursor: "pointer",
      })
        .circle(0, 0, radius)
        .fill({ color })
        .stroke({ width: 2, color: theme.background });

      const alpha = viewMode === 'focus' ? calculateNodeAlpha(distance) : 1;

      // Label
      const label = new Text({
        interactive: false,
        eventMode: "none",
        text: node.text,
        alpha: viewMode === 'focus' ? alpha : 1,
        anchor: { x: 0.5, y: 1.8 },
        style: {
          fontSize: distance === 0 ? 10 : 9,
          fill: theme.label,
          fontFamily:
            "PingFang SC, Microsoft YaHei, -apple-system, BlinkMacSystemFont, sans-serif",
        },
        resolution: window.devicePixelRatio * 4,
      });

      nodeContainer.addChild(graphics);
      labelContainer.addChild(label);

      renderedNodes.push({
        data: node,
        graphics,
        label,
        color,
        alpha: viewMode === 'focus' ? alpha : 1,
      });
    }

  // Hover state
  let hoveredNodeId: string | null = null;

  function updateHoverState(newHoverId: string | null) {
    hoveredNodeId = newHoverId;

    const hoveredNeighbors = new Set<string>();

    if (newHoverId) {
      for (const link of links) {
        if (link.source.id === newHoverId || link.target.id === newHoverId) {
          hoveredNeighbors.add(link.source.id);
          hoveredNeighbors.add(link.target.id);
        }
      }
    }

    const focusNode = newHoverId ?? centerId;

    for (const link of renderedLinks) {
      const isHoverRelated = newHoverId &&
        (link.data.source.id === newHoverId || link.data.target.id === newHoverId);
      const isActive =
        link.data.source.id === focusNode || link.data.target.id === focusNode;

      if (newHoverId) {
        link.alpha = isHoverRelated ? 1 : 0.1;
      } else {
        const distance = Math.min(
          getNodeDistanceFromCenter(link.data.source.id, links, focusNode),
          getNodeDistanceFromCenter(link.data.target.id, links, focusNode)
        );
        link.alpha = isActive ? 1 : Math.max(0.1, calculateNodeAlpha(distance) - 0.2);
      }
    }

    for (const node of renderedNodes) {
      if (newHoverId) {
        const isHoveredOrNeighbor = hoveredNeighbors.has(node.data.id);
        node.alpha = isHoveredOrNeighbor ? 1 : 0.2;
        node.label.alpha = isHoveredOrNeighbor ? 1 : 0.2;
      } else {
        const distance = getNodeDistanceFromCenter(node.data.id, links, centerId);
        const nodeAlpha = viewMode === 'focus' ? calculateNodeAlpha(distance) : 1;
        node.alpha = nodeAlpha;
        node.label.alpha = nodeAlpha;
      }
    }
  }

  // Add hover events
  for (const node of renderedNodes) {
    node.graphics.on("pointerover", () => {
      updateHoverState(node.data.id);
    });
    node.graphics.on("pointerleave", () => {
      updateHoverState(null);
    });

    node.graphics.on("click", () => {
      window.location.href = node.data.id;
    });
  }

  // D3 zoom behavior
  const zoomBehavior = d3
    .zoom<HTMLCanvasElement, unknown>()
    .extent([
      [0, 0],
      [width, height],
    ])
    .scaleExtent([0.1, 4])
    .on("zoom", (event) => {
      const { transform } = event;
      stage.scale.set(transform.k, transform.k);
      stage.position.set(transform.x, transform.y);

      const scale = transform.k;
      const scaleOpacity = Math.max((scale - 0.5) / 3.5, 0);

      for (const node of renderedNodes) {
        if (node.data.id !== hoveredNodeId) {
          const distance = getNodeDistanceFromCenter(node.data.id, links, currentId);
          if (distance <= 1) {
            node.label.alpha = distance === 0 ? 1 : 0.85;
          } else {
            // In full mode, maintain consistent opacity based on zoom
            const baseOpacity = viewMode === 'focus' ? node.alpha : 1;
            node.label.alpha = Math.max(scaleOpacity * baseOpacity, 0.3);
          }
        }
      }
    });

  const canvasSelection = d3.select<HTMLCanvasElement, unknown>(app.canvas);
  canvasSelection.call(zoomBehavior);

  canvasSelection.call(
    zoomBehavior.transform,
    d3.zoomIdentity.translate(width / 2, height / 2),
  );

  // Render loop
  function animate() {
    for (const node of renderedNodes) {
      const { x, y } = node.data;
      if (x != null && y != null) {
        node.graphics.position.set(x, y);
        node.label.position.set(x, y);
      }
    }

    for (const link of renderedLinks) {
      const { source, target } = link.data;
      if (
        source.x != null &&
        source.y != null &&
        target.x != null &&
        target.y != null
      ) {
        link.graphics.clear();
        link.graphics
          .moveTo(source.x, source.y)
          .lineTo(target.x, target.y)
          .stroke({ alpha: link.alpha, width: 1, color: link.color });
      }
    }

    app.renderer.render(stage);
    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
}

// Helper functions
async function getGraphData(currentId?: string): Promise<{
  nodes: NodeData[];
  links: LinkData[];
}> {
  const response = await fetch("/api/graph-data");
  if (!response.ok) {
    throw new Error("Failed to fetch graph data");
  }
  const data = await response.json();

  // Convert to D3 format
  const nodeMap = new Map<string, NodeData>();
  const currentPermalink = currentId ?? getCurrentPermalink();

  // Create nodes
  for (const node of data.nodes) {
    const id = normalizePermalink(String(node.id));
    nodeMap.set(id, {
      id,
      text: node.text,
      isCurrent: id === currentPermalink,
      isVisited: node.visited,
    } as NodeData);
  }

  // Create links
  const links = data.links
    .map((link: any) => {
      const sourceId = normalizePermalink(String(link.source));
      const targetId = normalizePermalink(String(link.target));
      const source = nodeMap.get(sourceId);
      const target = nodeMap.get(targetId);
      if (!source || !target) return null;
      return { source, target };
    })
    .filter((l: any): l is { source: NodeData; target: NodeData } => l != null);

  return {
    nodes: Array.from(nodeMap.values()),
    links,
  };
}

function normalizePermalink(permalink: string): string {
  const trimmed = permalink.trim();
  if (trimmed === "" || trimmed === "/") return "/";
  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash.slice(0, -1) : withLeadingSlash;
}

function getCurrentPermalink(): string {
  return normalizePermalink(window.location.pathname);
}

function getCurrentOrPropPermalink(currentPermalink?: string): string {
  if (currentPermalink == null) return getCurrentPermalink();
  return normalizePermalink(currentPermalink);
}

function getVisited(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem("graph-visited") || "[]");
    if (!Array.isArray(raw)) return new Set();
    return new Set(raw.map((p) => normalizePermalink(String(p))));
  } catch {
    return new Set();
  }
}

function addToVisited(permalink: string) {
  const visited = getVisited();
  visited.add(normalizePermalink(permalink));
  localStorage.setItem("graph-visited", JSON.stringify([...visited]));
}

function getNeighborhood(
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

function getNodeColor(node: NodeData, theme: GraphThemeColors): string {
  if (node.isCurrent) {
    return theme.nodeCurrent;
  }
  if (node.isVisited) {
    return theme.nodeVisited;
  }
  return theme.nodeDefault;
}

function getNodeRadius(node: NodeData, links: LinkData[]): number {
  const numLinks = links.filter(
    (l) => l.source.id === node.id || l.target.id === node.id,
  ).length;
  return 3 + Math.sqrt(numLinks);
}

function getNodeDistanceFromCenter(
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

function calculateNodeAlpha(distance: number): number {
  // 线性衰减：距离每增加1，alpha减少0.15，最低0.05
  if (distance === 0) return 1;
  if (distance === Infinity) return 0;

  const alpha = 1 - (distance * 0.15);
  return Math.max(0.05, alpha);
}

// Main Graph component
export default function Graph({ currentPermalink }: GraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [themeVersion, setThemeVersion] = useState(0);

  useEffect(() => {
    const currentPermalinkFromPath = getCurrentPermalink();
    addToVisited(currentPermalinkFromPath);

    if (containerRef.current) {
      renderGraph(containerRef.current);
    }

    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "attributes" && record.attributeName === "class") {
          if (containerRef.current) {
            renderGraph(containerRef.current);
          }
          setThemeVersion((v) => v + 1);
          break;
        }
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isModalOpen) {
        setIsModalOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
      observer.disconnect();
    };
  }, [isModalOpen]);

  async function renderGraph(container: HTMLDivElement) {
    console.log('[Graph] renderGraph called', { container });
    if (!container) return;

    const theme = getGraphThemeColors();

    container.innerHTML = "";
    console.log('[Graph] Fetching graph data...');

    const centerNodeId = getCurrentOrPropPermalink(currentPermalink);

    const { nodes: allNodes, links: allLinks } = await getGraphData(centerNodeId);
    console.log('[Graph] Graph data received:', { nodeCount: allNodes.length, linkCount: allLinks.length });

    // Filter to neighborhood
    let neighborhood = getNeighborhood(
      allNodes,
      allLinks,
      centerNodeId,
      CONFIG.depth,
    );

    console.log('[Graph] neighborhood size:', neighborhood.size, 'total nodes:', allNodes.length);

    if (neighborhood.size <= 1) {
      console.log('[Graph] Current node has no connections, showing only current node');
      neighborhood = new Set([centerNodeId]);
    }

    const nodes = allNodes.filter((n) => neighborhood.has(n.id));

    // Filter and map links
    const links: LinkData[] = [];
    for (const l of allLinks) {
      if (neighborhood.has(l.source.id) && neighborhood.has(l.target.id)) {
        const sourceNode = nodes.find((n) => n.id === l.source.id);
        const targetNode = nodes.find((n) => n.id === l.target.id);
        if (sourceNode && targetNode) {
          links.push({
            source: sourceNode,
            target: targetNode,
          });
        }
      }
    }

    // Create D3 force simulation
    const simulation = d3
      .forceSimulation<NodeData>(nodes)
      .force("charge", d3.forceManyBody().strength(-100 * CONFIG.repelForce))
      .force("center", d3.forceCenter().strength(CONFIG.centerForce))
      .force("link", d3.forceLink(links).distance(CONFIG.linkDistance))
      .force(
        "collide",
        d3.forceCollide<NodeData>((n) => getNodeRadius(n, links)).iterations(3),
      );

    // Initialize Pixi.js application
    const width = container.offsetWidth;
    const height = container.offsetHeight;
    const dpr = window.devicePixelRatio || 1;

    const app = new Application();
    await app.init({
      width,
      height,
      antialias: true,
      autoStart: false,
      resolution: dpr,
      backgroundAlpha: 0,
      resizeTo: container,
    });

    container.appendChild(app.canvas);
    app.canvas.style.width = "100%";
    app.canvas.style.height = "100%";

    const stage = app.stage;
    stage.interactive = false;

    // Containers for layers
    const linkContainer = new Container<Graphics>({ zIndex: 1 });
    const nodeContainer = new Container<Graphics>({ zIndex: 2 });
    const labelContainer = new Container<Text>({ zIndex: 3 });
    stage.addChild(linkContainer, nodeContainer, labelContainer);

    // Render links
    const renderedLinks: RenderedLink[] = [];
    for (const link of links) {
      const graphics = new Graphics({ interactive: false, eventMode: "none" });
      linkContainer.addChild(graphics);

      renderedLinks.push({
        data: link,
        graphics,
        color: theme.link,
        alpha: 1,
      });
    }

    // Render nodes
    const renderedNodes: RenderedNode[] = [];

    for (const node of nodes) {
      const radius = getNodeRadius(node, links);
      const color = getNodeColor(node, theme);
      const distance = getNodeDistanceFromCenter(node.id, links, centerNodeId);

      const graphics = new Graphics({
        interactive: true,
        eventMode: "static",
        hitArea: new Circle(0, 0, radius),
        cursor: "pointer",
      })
        .circle(0, 0, radius)
        .fill({ color })
        .stroke({ width: 2, color: theme.background });

      const label = new Text({
        interactive: false,
        eventMode: "none",
        text: node.text,
        alpha: calculateNodeAlpha(distance),
        anchor: { x: 0.5, y: 1.8 },
        style: {
          fontSize: distance === 0 ? CONFIG.fontSize * 1.1 : CONFIG.fontSize,
          fill: theme.label,
          fontFamily:
            "PingFang SC, Microsoft YaHei, -apple-system, BlinkMacSystemFont, sans-serif",
        },
        resolution: window.devicePixelRatio * 4,
      });
      label.scale.set(1 / CONFIG.scale);

      nodeContainer.addChild(graphics);
      labelContainer.addChild(label);

      renderedNodes.push({
        data: node,
        graphics,
        label,
        color,
        alpha: calculateNodeAlpha(distance),
      });
    }

    // Hover state
    let hoveredNodeId: string | null = null;

    function updateHoverState(newHoverId: string | null) {
      hoveredNodeId = newHoverId;

      const hoveredNeighbors = new Set<string>();

      if (newHoverId) {
        for (const link of links) {
          if (link.source.id === newHoverId || link.target.id === newHoverId) {
            hoveredNeighbors.add(link.source.id);
            hoveredNeighbors.add(link.target.id);
          }
        }
      }

      const focusNode = newHoverId ?? centerNodeId;

      for (const link of renderedLinks) {
        const isActive =
          link.data.source.id === focusNode || link.data.target.id === focusNode;
        const distance = Math.min(
          getNodeDistanceFromCenter(link.data.source.id, links, focusNode),
          getNodeDistanceFromCenter(link.data.target.id, links, focusNode)
        );
        link.alpha = isActive ? 1 : Math.max(0.1, calculateNodeAlpha(distance) - 0.2);
      }

      for (const node of renderedNodes) {
        const distance = getNodeDistanceFromCenter(node.data.id, links, focusNode);
        node.alpha = calculateNodeAlpha(distance);
        node.label.alpha = calculateNodeAlpha(distance);
      }
    }

    // Add hover events
    for (const node of renderedNodes) {
      node.graphics.on("pointerover", () => {
        updateHoverState(node.data.id);
      });
      node.graphics.on("pointerleave", () => {
        updateHoverState(null);
      });

      node.graphics.on("click", () => {
        window.location.href = node.data.id;
      });
    }

    let currentTransform = d3.zoomIdentity;
    let isDragging = false;

    // D3 drag behavior
    const drag = d3
      .drag<HTMLCanvasElement, NodeData>()
      .container(() => app.canvas)
      .subject(
        () => renderedNodes.find((n) => n.data.id === hoveredNodeId)?.data,
      )
      .on("start", (event) => {
        if (!event.active) simulation.alphaTarget(1).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
        (event.subject as any).__initialDragPos = {
          x: event.subject.x,
          y: event.subject.y,
          fx: event.subject.fx,
          fy: event.subject.fy,
        };
        isDragging = true;
      })
      .on("drag", (event) => {
        const initPos = (event.subject as any).__initialDragPos;
        event.subject.fx =
          initPos.x + (event.x - initPos.x) / currentTransform.k;
        event.subject.fy =
          initPos.y + (event.y - initPos.y) / currentTransform.k;
      })
      .on("end", (event) => {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
        isDragging = false;
      });

    if (CONFIG.drag) {
      d3.select<HTMLCanvasElement, NodeData>(app.canvas).call(drag as any);
    }

    // D3 zoom behavior
    if (CONFIG.zoom) {
      d3.select<HTMLCanvasElement, NodeData>(app.canvas).call(
        d3
          .zoom<HTMLCanvasElement, NodeData>()
          .extent([
            [0, 0],
            [width, height],
          ])
          .scaleExtent([0.25, 4])
          .on("zoom", ({ transform }) => {
            currentTransform = transform;
            stage.scale.set(transform.k, transform.k);
            stage.position.set(transform.x, transform.y);

            const scale = transform.k * CONFIG.opacityScale;
            const scaleOpacity = Math.max((scale - 1) / 3.75, 0);

            for (const node of renderedNodes) {
              if (node.data.id !== hoveredNodeId) {
                const distance = getNodeDistanceFromCenter(node.data.id, links, centerNodeId);
                if (distance <= 1) {
                  node.label.alpha = distance === 0 ? 1 : 0.85;
                } else {
                  node.label.alpha = Math.max(scaleOpacity * node.alpha, 0.3);
                }
              }
            }
          }) as any,
      );
    }

    // Render loop
    function animate() {
      for (const node of renderedNodes) {
        const { x, y } = node.data;
        if (x != null && y != null) {
          node.graphics.position.set(x + width / 2, y + height / 2);
          node.label.position.set(x + width / 2, y + height / 2);
        }
      }

      for (const link of renderedLinks) {
        const { source, target } = link.data;
        if (
          source.x != null &&
          source.y != null &&
          target.x != null &&
          target.y != null
        ) {
          link.graphics.clear();
          link.graphics
            .moveTo(source.x + width / 2, source.y + height / 2)
            .lineTo(target.x + width / 2, target.y + height / 2)
            .stroke({ alpha: link.alpha, width: 1, color: link.color });
        }
      }

      app.renderer.render(stage);
      requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
  }

  return (
    <>
      <div id="graph-container" className="graph">
        <div className="graph-outer" ref={containerRef} id="graph-canvas-container"></div>
        <button
          className="fullscreen-button"
          title="查看完整关系图"
          onClick={() => setIsModalOpen(true)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
          </svg>
        </button>
      </div>

      <FullGraphModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        themeVersion={themeVersion}
        currentPermalink={currentPermalink}
      />
    </>
  );
}
