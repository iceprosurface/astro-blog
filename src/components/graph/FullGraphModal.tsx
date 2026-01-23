import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { GraphConfig, NodeData, LinkData } from './types/graph.types';
import { useTheme } from './hooks/useTheme';
import { useGraphRenderer } from './hooks/useGraphRenderer';
import { GraphControlPanel } from './GraphControlPanel';
import { useGraphStore } from './store';
import { getCurrentOrPropPermalink } from './utils/graphHelpers';
import './Graph.css';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    currentPermalink?: string;
    graphData: { nodes: NodeData[]; links: LinkData[] };
}

export function FullGraphModal({ isOpen, onClose, currentPermalink, graphData }: Props) {
    const [container, setContainer] = useState<HTMLDivElement | null>(null);
    const { theme } = useTheme();

    const {
        repelForce, centerForce, linkDistance, showTags, focusOnHover
    } = useGraphStore();

    const config: GraphConfig = useMemo(() => ({
        drag: true,
        zoom: true,
        depth: Infinity,
        scale: 1,
        fontSize: 10,
        opacityScale: 1,
        repelForce,
        centerForce,
        linkDistance,
        showTags,
        focusOnHover,
    }), [repelForce, centerForce, linkDistance, showTags, focusOnHover]);

    const filteredData = useMemo(() => {
        if (config.showTags) return graphData;
        return {
            nodes: graphData.nodes.filter((n) => n.nodeType !== 'tag'),
            links: graphData.links.filter((l) => l.linkType !== 'tag'),
        };
    }, [graphData, config.showTags]);

    const centerId = getCurrentOrPropPermalink(currentPermalink);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) onClose();
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    useGraphRenderer(
        isOpen ? container : null,
        filteredData.nodes,
        filteredData.links,
        theme,
        config,
        centerId,
        'full'
    );

    if (!isOpen) return null;

    if (typeof document === 'undefined') return null;

    return createPortal(
        <div className="graph-modal active" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal-content">
                <div className="graph-toolbar">
                    <GraphControlPanel />
                    <button className="modal-close-btn" onClick={onClose}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6L6 18M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>

                <div className="modal-body-full">
                    <div ref={setContainer} className="full-graph-container"></div>
                </div>
            </div>
        </div>,
        document.body
    );
}
