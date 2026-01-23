import { useState, useEffect } from 'react';
import type { NodeData, LinkData } from '../types/graph.types';
import { normalizePermalink, getCurrentOrPropPermalink } from '../utils/graphHelpers';
import { addToVisited, getVisited } from '../utils/visitedStorage';

export function useGraphData(currentPermalink?: string) {
    const [data, setData] = useState<{ nodes: NodeData[]; links: LinkData[] }>({ nodes: [], links: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        async function fetchData() {
            try {
                const currentId = getCurrentOrPropPermalink(currentPermalink); // Normalize
                if (typeof window !== 'undefined') {
                    addToVisited(currentId);
                }

                const response = await fetch("/api/graph-data");
                if (!response.ok) throw new Error("Failed to fetch graph data");
                const json = await response.json();

                if (!mounted) return;

                const visitedSet = getVisited();
                const nodeMap = new Map<string, NodeData>();

                // Create Nodes
                for (const node of json.nodes) {
                    const id = normalizePermalink(String(node.id));
                    nodeMap.set(id, {
                        id,
                        text: node.text,
                        isCurrent: id === currentId,
                        isVisited: visitedSet.has(id),
                        nodeType: node.nodeType || 'article', // Default to article if missing
                        tags: node.tags,
                    } as NodeData);
                }

                // Create Links
                const links = json.links
                    .map((link: any) => {
                        const sourceId = normalizePermalink(String(link.source));
                        const targetId = normalizePermalink(String(link.target));
                        const source = nodeMap.get(sourceId);
                        const target = nodeMap.get(targetId);
                        if (!source || !target) return null;
                        return {
                            source,
                            target,
                            linkType: link.linkType || 'reference'
                        };
                    })
                    .filter((l: any): l is LinkData => l != null);

                setData({
                    nodes: Array.from(nodeMap.values()),
                    links,
                });
            } catch (err) {
                console.error("Graph data load failed:", err);
            } finally {
                if (mounted) setLoading(false);
            }
        }

        fetchData();

        return () => {
            mounted = false;
        };
    }, [currentPermalink]);

    return { graphData: data, loading };
}
