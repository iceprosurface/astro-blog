import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	// Type-check frontmatter using a schema
	schema: () =>
		z.object({
			title: z.string().optional().nullable(),
			description: z.string().optional().nullable(),
			// Transform string to Date object
			date: z.coerce.date().optional().nullable(),
			updated: z.coerce.date().optional().nullable(),
			updatedDate: z.coerce.date().optional().nullable(),
			permalink: z.string().optional().nullable(),
			tags: z.array(z.string()).nullish().transform(v => v ?? []),
			ccby: z.boolean().optional().default(false),
			['no-rss']: z.boolean().optional().default(false),
			draft: z.boolean().default(false),
			comments: z.boolean().optional().default(true),
			hasMath: z.boolean().optional(),
			// 转载/非原创相关元数据
			'origin-link': z.string().optional().nullable(),
			'origin-author': z.string().optional().nullable(),
			'origin-license': z.string().optional().nullable(),
			'origin-note': z.string().optional().nullable(),
			'folderChildren': z.object({
				folders: z.array(z.string()),
				files: z.array(z.object({
					title: z.string(),
					permalink: z.string(),
					date: z.date().optional().nullable(),
				})),
			}).optional().nullable(),
		}),
});

export const collections = { blog };
