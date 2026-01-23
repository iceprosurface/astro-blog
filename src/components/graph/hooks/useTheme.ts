import { useState, useEffect } from 'react';
import type { GraphThemeColors } from '../types/graph.types';

export function getGraphThemeColors(): GraphThemeColors {
    if (typeof window === 'undefined') {
        return {
            background: '#f8fafc',
            link: '#cbd5e1',
            linkTag: '#fcd34d',
            label: '#1e293b',
            nodeCurrent: '#e11d48',
            nodeVisited: '#0891b2',
            nodeDefault: '#64748b',
            nodeTag: '#f59e0b',
        };
    }
    const style = getComputedStyle(document.documentElement);
    return {
        background: style.getPropertyValue('--graph-bg').trim() || '#f8fafc',
        link: style.getPropertyValue('--graph-link').trim() || '#cbd5e1',
        linkTag: style.getPropertyValue('--graph-link-tag').trim() || '#fcd34d',
        label: style.getPropertyValue('--graph-label').trim() || '#1e293b',
        nodeCurrent: style.getPropertyValue('--graph-node-current').trim() || '#e11d48',
        nodeVisited: style.getPropertyValue('--graph-node-visited').trim() || '#0891b2',
        nodeDefault: style.getPropertyValue('--graph-node-default').trim() || '#64748b',
        nodeTag: style.getPropertyValue('--graph-node-tag').trim() || '#f59e0b',
    };
}

export function useTheme() {
    const [theme, setTheme] = useState<GraphThemeColors>(getGraphThemeColors());
    const [version, setVersion] = useState(0);

    useEffect(() => {
        // Initial load
        setTheme(getGraphThemeColors());

        // Observe class changes on html (for dark mode toggle)
        const observer = new MutationObserver((records) => {
            for (const record of records) {
                if (record.type === "attributes" && record.attributeName === "class") {
                    setTheme(getGraphThemeColors());
                    setVersion(v => v + 1);
                    break;
                }
            }
        });

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["class"],
        });

        return () => observer.disconnect();
    }, []);

    return { theme, version };
}
