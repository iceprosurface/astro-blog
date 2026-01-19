import { visit } from 'unist-util-visit';
import { toString } from 'mdast-util-to-string';

/**
 * Rehype plugin to add slug (id) to headings
 * Generates stable, URL-friendly IDs from heading text
 */
export default function rehypeSlug() {
    return (tree) => {
        visit(tree, 'element', (node) => {
            if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(node.tagName)) {
                const text = toString(node);
                const slug = generateSlug(text);

                if (!node.properties) {
                    node.properties = {};
                }
                node.properties.id = slug;
            }
        });
    };
}

function generateSlug(text) {
    return text
        .toLowerCase()
        .trim()
        // Remove special characters, keep Chinese characters
        .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
        // Replace spaces and underscores with hyphens
        .replace(/[\s_]+/g, '-')
        // Remove consecutive hyphens
        .replace(/-+/g, '-')
        // Remove leading/trailing hyphens
        .replace(/^-+|-+$/g, '');
}
