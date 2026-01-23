import { useRef, useMemo, useState } from 'react';
import type { GraphConfig } from './types/graph.types';
import { useTheme } from './hooks/useTheme';
import { useGraphData } from './hooks/useGraphData';
import { useGraphRenderer } from './hooks/useGraphRenderer';
import { getCurrentOrPropPermalink, getNeighborhood } from './utils/graphHelpers';
import { FullGraphModal } from './FullGraphModal';
import './Graph.css';

interface GraphProps {
    currentPermalink?: string;
}

const SIDEBAR_CONFIG: GraphConfig = {
    drag: true,
    zoom: true,
    depth: 1, // Only show immediate neighbors
    scale: 1.2,
    repelForce: 1.2,
    centerForce: 0.3,
    linkDistance: 60,
    fontSize: 10,
    opacityScale: 3,
    focusOnHover: true,
    showTags: true, // Show tags in sidebar as requested
};

export default function Graph({ currentPermalink }: GraphProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const { theme } = useTheme();
    const { graphData } = useGraphData(currentPermalink);

    const centerId = getCurrentOrPropPermalink(currentPermalink);

    const neighborhoodData = useMemo(() => {
        if (graphData.nodes.length === 0) return { nodes: [], links: [] };

        let neighborhoodIds = getNeighborhood(
            graphData.nodes,
            graphData.links,
            centerId,
            SIDEBAR_CONFIG.depth
        );

        // If isolated (only self found), just show self
        if (neighborhoodIds.size <= 1) {
            neighborhoodIds = new Set([centerId]);
        }

        const nodes = graphData.nodes.filter(n => neighborhoodIds.has(n.id));

        // Filter links: both source and target must be in neighborhood
        const links = graphData.links.filter(l =>
            neighborhoodIds.has(l.source.id) && neighborhoodIds.has(l.target.id)
        );

        return { nodes, links };
    }, [graphData, centerId]);

    // Render Logic
    useGraphRenderer(
        containerRef.current,
        neighborhoodData.nodes,
        neighborhoodData.links,
        theme,
        SIDEBAR_CONFIG,
        centerId,
        'focus'
    );

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
                currentPermalink={currentPermalink}
                graphData={graphData}
            />
        </>
    )
}
