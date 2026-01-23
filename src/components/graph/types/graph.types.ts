import type * as d3 from 'd3';
import type { Container, Graphics, Text } from 'pixi.js';

// ===== 节点类型 =====
export type NodeType = 'article' | 'tag';

export type LinkType = 'reference' | 'tag';

export interface NodeData extends d3.SimulationNodeDatum {
    id: string;
    text: string;
    isCurrent: boolean;
    isVisited: boolean;
    nodeType: NodeType;
    tags?: string[]; // 仅 article 类型
}

export interface LinkData extends d3.SimulationLinkDatum<NodeData> {
    source: NodeData;
    target: NodeData;
    linkType: LinkType;
}

// ===== 渲染状态 =====
export interface RenderedNode {
    data: NodeData;
    graphics: Graphics;
    label: Text;
    color: string;
    alpha: number;
    targetAlpha: number;
    baseAlpha: number; // Optimization: pre-calculated alpha based on center distance
}

export interface RenderedLink {
    data: LinkData;
    graphics: Graphics;
    color: string;
    alpha: number;
    targetAlpha: number;
    baseAlpha: number;
}

// ===== 主题 =====
export interface GraphThemeColors {
    background: string;
    link: string;
    linkTag: string;      // Tag 链接颜色
    label: string;
    nodeCurrent: string;
    nodeVisited: string;
    nodeDefault: string;
    nodeTag: string;      // Tag 节点颜色
}

// ===== 配置 =====
export interface GraphConfig {
    drag: boolean;
    zoom: boolean;
    depth: number;
    scale: number;
    repelForce: number;    // 可调节
    centerForce: number;   // 可调节
    linkDistance: number;  // 可调节
    fontSize: number;
    opacityScale: number;
    focusOnHover: boolean;
    showTags: boolean;     // 是否显示 Tag 节点
}

// ===== Props =====
export interface GraphProps {
    currentPermalink?: string;
}

export interface ControlPanelProps {
    config: GraphConfig;
    onConfigChange: (config: Partial<GraphConfig>) => void;
    isExpanded: boolean;
    onToggle: () => void;
}
