// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import node from '@astrojs/node';
import react from '@astrojs/react';
import { defineConfig } from 'astro/config';

import remarkCallout from './src/plugins/remark-callout.mjs';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkMathFlag from './src/plugins/remark-math-flag.mjs';
import rehypeMarkExternalLinks from './src/plugins/rehype-mark-external-links.mjs';
import manualRedirects from './src/manual-redirects.json';
import redirects from './src/redirects.json'
// https://astro.build/config
export default defineConfig({
	redirects: {
		...manualRedirects,
		...redirects,
	},
	site: 'https://iceprosurface.com',
	integrations: [mdx(), sitemap({
		filter: (page) =>
			page !== 'https://iceprosurface.com/preview/' &&
			!page.includes('/preview/') &&
			!page.includes('/api/'),
	}), react()],
	output: 'server',
	adapter: node({
		mode: 'standalone',
	}),
	vite: {
		build: {
			rollupOptions: {
				external: ['flexsearch']
			}
		}
	},
	markdown: {
		syntaxHighlight: {
			type: 'shiki',
			excludeLangs: ['mermaid', 'math'],
		},
		remarkPlugins: [
			remarkMath,
			remarkMathFlag,
			remarkCallout,
		],
		rehypePlugins: [
			[rehypeKatex, { output: 'html' }],
			rehypeMarkExternalLinks,
		],
		shikiConfig: {
			themes: {
				light: 'github-light',
				dark: 'github-dark',
			},
			langAlias: {
				'compressed-json': 'plain'
			},
			transformers: [
				{
					// @ts-ignore
					line(node, line) {
						node.properties['data-line'] = line;
					},
					pre(node) {
						node.children.push({
							type: 'element',
							tagName: 'button',
							properties: {
								className: ['clipboard-button'],
								type: 'button',
								'aria-label': 'Copy source',
							},
							children: [
								{
									type: 'element',
									tagName: 'svg',
									properties: {
										'aria-hidden': 'true',
										height: '16',
										viewBox: '0 0 16 16',
										version: '1.1',
										width: '16',
										fill: 'currentColor',
									},
									children: [
										{
											type: 'element',
											tagName: 'path',
											properties: {
												'fill-rule': 'evenodd',
												d: 'M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z',
											},
											children: [],
										},
										{
											type: 'element',
											tagName: 'path',
											properties: {
												'fill-rule': 'evenodd',
												d: 'M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z',
											},
											children: [],
										},
									],
								},
							],
						});
					},
				},
			],
		},
	},
});