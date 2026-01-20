
/**
 * Handles smooth animation for <details> elements functioning as callouts/accordions.
 * Uses requestAnimationFrame for performant height transitions.
 */
export function initCalloutAnimations() {
    const detailsElements = document.querySelectorAll('details.callout');

    detailsElements.forEach((details) => {
        // Check if already initialized to avoid duplicate listeners
        if (details.dataset.animated === 'true') return;
        details.dataset.animated = 'true';

        const summary = details.querySelector('summary');
        if (!summary) return;

        summary.addEventListener('click', (e) => {
            e.preventDefault();

            // If already animating, ignore clicks to prevent glitching
            if (details.hasAttribute('data-animating')) {
                return;
            }

            // Add 'data-animating' to prevent double clicks and styling content
            details.setAttribute('data-animating', '');

            if (details.open) {
                // Closing animation
                const content = details.querySelector('.callout-content');
                if (content) {
                    // Get current height
                    const startHeight = content.offsetHeight;

                    // Set fixed height to prepare for transition
                    // We animate the layout container (details) typically? 
                    // Better to animate the content wrapper height from X to 0.

                    // Wait, we can't easily animate 'details' height if it has padding.
                    // Our .callout has padding.

                    // Refined strategy: Animate content expansion.

                    // Step 1: Lock height
                    details.style.height = `${details.offsetHeight}px`;
                    details.style.overflow = 'hidden'; // Ensure content is clipped

                    // Force repaint
                    requestAnimationFrame(() => {
                        // Calculate target height: Summary height + padding
                        // .callout has padding 0 1rem. summary has padding 1rem 0 0.5rem 0.
                        // It's tricky with paddings on parent.

                        // Let's use a temporary measuring:
                        // When closed, details height is basically header height + vertical padding of details
                        // Standard details height = offsetHeight of summary + details top/bottom borders/padding.

                        // Actually, simply setting explicit start height is enough.
                        const startH = details.offsetHeight;
                        const targetH = summary.offsetHeight + 2; // +2 for border estimate or getComputedStyle

                        // Actually safer to read computed style padding
                        const computed = getComputedStyle(details);
                        const padTop = parseFloat(computed.paddingTop);
                        const padBottom = parseFloat(computed.paddingBottom);
                        const borderTop = parseFloat(computed.borderTopWidth);
                        const borderBottom = parseFloat(computed.borderBottomWidth);

                        // Target height = summary height + vertical padding/borders of container
                        const closedHeight = summary.offsetHeight + padTop + padBottom + borderTop + borderBottom;

                        // Set transition
                        details.style.transition = 'height 0.3s ease';
                        details.style.height = `${startH}px`;

                        requestAnimationFrame(() => {
                            details.style.height = `${closedHeight}px`;
                        });
                    });

                    // Cleanup after transition
                    details.addEventListener('transitionend', function onEnd() {
                        details.removeAttribute('open');
                        details.removeAttribute('data-animating');
                        details.style.height = '';
                        details.style.overflow = '';
                        details.style.transition = '';
                        details.removeEventListener('transitionend', onEnd);
                    }, { once: true });
                } else {
                    // Fallback if structure makes no sense
                    details.removeAttribute('open');
                    details.removeAttribute('data-animating');
                }
            } else {
                // Opening animation

                // 1. Measure target height
                // Add open attribute but hide content via overflow hidden + fixed height

                // Before opening, measure current height
                const startHeight = details.offsetHeight;

                details.setAttribute('open', '');

                // Now it's open, content blocks are displayed.
                // We need to capture the full height.
                // But we want to start animation from 'startHeight'.

                const fullHeight = details.offsetHeight;

                // Set styles to start state
                details.style.height = `${startHeight}px`;
                details.style.overflow = 'hidden';
                details.style.transition = 'height 0.3s ease';

                // Force repaint
                requestAnimationFrame(() => {
                    details.setAttribute('data-animating', '');
                    details.style.height = `${fullHeight}px`;
                });

                // Cleanup after transition
                details.addEventListener('transitionend', function onEnd() {
                    details.removeAttribute('data-animating');
                    details.style.height = '';
                    details.style.overflow = '';
                    details.style.transition = '';
                    details.removeEventListener('transitionend', onEnd);
                }, { once: true });
            }
        });
    });
}
