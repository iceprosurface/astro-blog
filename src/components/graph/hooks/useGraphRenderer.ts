import { useEffect, useRef, useState } from 'react';
import { PixiRenderer } from '../renderer/PixiRenderer';
import { GraphSimulator } from '../renderer/GraphSimulator';
import type { GraphConfig, NodeData, LinkData, GraphThemeColors } from '../types/graph.types';

export function useGraphRenderer(
    container: HTMLDivElement | null,
    nodes: NodeData[],
    links: LinkData[],
    theme: GraphThemeColors,
    config: GraphConfig,
    centerId: string,
    viewMode: 'focus' | 'full' = 'focus',
    onNodeClick?: (nodeId: string) => void
) {
    const rendererRef = useRef<PixiRenderer | null>(null);
    const simulatorRef = useRef<GraphSimulator | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // 1. Initialize Renderer (Canvas)
    useEffect(() => {
        if (!container) return;

        const renderer = new PixiRenderer();
        rendererRef.current = renderer;

        let mounted = true;
        let resizeObserver: ResizeObserver | null = null;

        renderer.init(container).then(() => {
            if (mounted) {
                setIsReady(true);

                // Add ResizeObserver to handle container resizing
                resizeObserver = new ResizeObserver(() => {
                    if (renderer.app) {
                        renderer.app.resize();
                        const width = renderer.app.screen.width;
                        const height = renderer.app.screen.height;
                        if (simulatorRef.current) {
                            simulatorRef.current.updateCenter(width, height);
                        }
                    }
                });
                resizeObserver.observe(container);
            }
        });

        return () => {
            mounted = false;
            resizeObserver?.disconnect();

            if (simulatorRef.current) {
                simulatorRef.current.destroy();
                simulatorRef.current = null;
            }
            renderer.destroy();
            rendererRef.current = null;
            setIsReady(false);
        };
    }, [container]);

    // 2. Initialize or Update Simulation (Nodes/Links)
    useEffect(() => {
        const renderer = rendererRef.current;
        if (!isReady || !renderer || !renderer.app) return;

        if (!simulatorRef.current) {
            simulatorRef.current = new GraphSimulator(
                renderer,
                theme,
                config,
                centerId,
                onNodeClick
            );
        }

        const width = renderer.app.screen.width;
        const height = renderer.app.screen.height;

        let active = true;
        setIsLoading(true);

        simulatorRef.current.init(nodes, links, width, height, viewMode);

        if (active) setIsLoading(false);

        return () => { active = false; };

    }, [isReady, rendererRef.current, nodes, links, theme, centerId, viewMode]);

    // 3. Update Configuration
    useEffect(() => {
        if (simulatorRef.current) {
            simulatorRef.current.updateConfig(config, links);
        }
    }, [config.repelForce, config.centerForce, config.linkDistance, config.focusOnHover, config.drag, config.zoom, config.fontSize]);

    return { isReady, isLoading };
}
