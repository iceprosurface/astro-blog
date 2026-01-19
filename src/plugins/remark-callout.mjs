export default function remarkCallout() {
console.log("[remark-callout] Plugin loaded");
  return (tree) => {
    function visit(node, index, parent) {
      if (node.type === 'blockquote') {
        const firstChild = node.children[0];
        if (firstChild?.type === 'paragraph' && firstChild.children[0]?.type === 'text') {
          const textNode = firstChild.children[0];
          const match = textNode.value.match(/^\[!(\w+)\][+-]? ?(.*)/);
          
          if (match) {
            const calloutType = match[1].toLowerCase();
            const titleLine = match[2];

            // Set blockquote properties
            node.data = node.data || {};
            node.data.hName = 'div';
            node.data.hProperties = {
              ...(node.data.hProperties || {}),
              className: `callout ${calloutType}`,
              'data-callout': calloutType
            };

            const titleContent = titleLine || (calloutType.charAt(0).toUpperCase() + calloutType.slice(1));
            
            // Create title child
            const titleNode = {
              type: 'paragraph',
              data: {
                hName: 'div',
                hProperties: { className: 'callout-title' }
              },
              children: [
                {
                  type: 'html',
                  value: '<div class="callout-icon"></div>'
                },
                {
                  type: 'paragraph',
                  data: {
                    hName: 'div',
                    hProperties: { className: 'callout-title-inner' }
                  },
                  children: [{ type: 'text', value: titleContent }]
                }
              ]
            };

            // Remove the [!tip] prefix from the first child text
            const firstLineBreak = textNode.value.indexOf('\n');
            if (firstLineBreak !== -1) {
              textNode.value = textNode.value.slice(firstLineBreak + 1);
            } else {
              firstChild.children.shift();
            }

            // If the first paragraph is now empty, remove it
            if (firstChild.children.length === 0) {
              node.children.shift();
            }

            // Wrap remaining children in a content div
            const remainingChildren = [...node.children];
            const contentNode = {
              type: 'div',
              data: {
                hName: 'div',
                hProperties: { className: 'callout-content' }
              },
              children: remainingChildren
            };

            // Replace callout children
            node.children = [titleNode, contentNode];
          }
        }
      }

      if (node.children) {
        node.children.forEach((child, i) => visit(child, i, node));
      }
    }
    visit(tree);
  };
}
