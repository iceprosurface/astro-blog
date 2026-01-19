import { visit } from 'unist-util-visit';

/**
 * Rehype plugin to mark external links with 'external' class
 * External links are those starting with http:// or https://
 */
export default function rehypeMarkExternalLinks() {
    return (tree) => {
        visit(tree, 'element', (node) => {
            if (node.tagName !== 'a') return;

            const href = node.properties?.href;
            if (!href || typeof href !== 'string') return;

            // Check if it's an external link
            const isExternal = href.startsWith('http://') || href.startsWith('https://');

            if (isExternal) {
                // Add target="_blank"
                node.properties.target = '_blank';
                // Add rel="noopener noreferrer" for security
                node.properties.rel = 'noopener noreferrer';

                // Add 'external' class
                const className = node.properties.className;
                if (Array.isArray(className)) {
                    if (!className.includes('external')) {
                        className.push('external');
                    }
                } else if (typeof className === 'string') {
                    const classes = className.split(' ');
                    if (!classes.includes('external')) {
                        node.properties.className = className + ' external';
                    }
                } else {
                    node.properties.className = ['external'];
                }
            }
        });
    };
}
