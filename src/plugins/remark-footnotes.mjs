/**
 * Remark plugin to parse footnotes
 * Supports syntax: [^1] and [^1]: footnote content
 */

import { visit } from 'unist-util-visit';

export default function remarkFootnotes() {
    const data = this.data();

    if (data.footnotes) {
        return;
    }

    // Store footnotes in data for later processing
    data.footnotes = [];

    // Pass 1: Collect footnote definitions and replace references
    return (tree) => {
        const footnotes = [];

        // Collect footnote definitions [^1]: content
        visit(tree, 'definition', (node) => {
            if (node.label && node.label.startsWith('^')) {
                const number = node.label.slice(1);
                footnotes.push({
                    number,
                    content: node.children || []
                });

                // Remove the definition node
                node.type = 'text';
                node.value = '';
            }
        });

        // Process footnote references [^1]
        visit(tree, 'footnoteReference', (node) => {
            const number = node.identifier || '';
            const footnoteIndex = footnotes.findIndex(f => f.number === number);

            if (footnoteIndex !== -1) {
                // Replace footnote reference with sup+a element
                node.type = 'html';
                node.value = `<sup><a href="#fn-${number}" id="fnref-${number}" class="footnote-ref">${number}</a></sup>`;
            }
        });

        // Add footnote definitions at the end of document
        if (footnotes.length > 0) {
            const footnoteSection = {
                type: 'element',
                tagName: 'div',
                properties: { className: ['footnotes'] },
                children: [
                    {
                        type: 'element',
                        tagName: 'h2',
                        properties: { id: 'footnote-label' },
                        children: [{ type: 'text', value: '脚注' }]
                    },
                    {
                        type: 'element',
                        tagName: 'ol',
                        properties: {},
                        children: footnotes.map((fn, index) => {
                            const backlink = {
                                type: 'element',
                                tagName: 'a',
                                properties: {
                                    href: `#fnref-${fn.number}`,
                                    className: ['footnote-backref'],
                                    'data-footnote-backref': true
                                },
                                children: [{ type: 'text', value: '↩' }]
                            };

                            return {
                                type: 'element',
                                tagName: 'li',
                                properties: { id: `fn-${fn.number}` },
                                children: [...fn.content, backlink]
                            };
                        })
                    }
                ]
            };

            tree.children.push(footnoteSection);
        }
    };
}
