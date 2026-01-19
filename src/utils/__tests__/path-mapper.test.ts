import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PathMapper } from '../path-mapper/path-mapper';

describe('PathMapper (New Architecture)', () => {
	let tempContentDir: string;
	let testFiles: Array<{ path: string; content: string }>;

	beforeEach(async () => {
		// Reset singleton instance before each test
		PathMapper.resetInstance();

		// Create a temporary content directory for testing
		tempContentDir = path.join(process.cwd(), 'test-content-new');
		if (!fs.existsSync(tempContentDir)) {
			fs.mkdirSync(tempContentDir, { recursive: true });
		}

		// Create test files
		testFiles = [
			{
				path: path.join(tempContentDir, 'index.md'),
				content: `---
title: Test Index
date: 2024-01-01
permalink: /
---

This is the index page.`,
			},
			{
				path: path.join(tempContentDir, 'test.md'),
				content: `---
title: Test Post
date: 2024-01-01
permalink: /test
---

This is a test post.

Links: [[Nested Index]], [/test], ../nested/child.md`,
			},
			{
				path: path.join(tempContentDir, 'nested', 'index.md'),
				content: `---
title: Nested Index
date: 2024-01-01
permalink: /nested
---

This is a nested index.`,
			},
			{
				path: path.join(tempContentDir, 'nested', 'child.md'),
				content: `---
title: Nested Child
date: 2024-01-01
permalink: /nested/child
---

This is a nested child.`,
			},
		];

		for (const file of testFiles) {
			const dir = path.dirname(file.path);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}
			fs.writeFileSync(file.path, file.content, 'utf-8');
		}

		// Mock astro:content module
		vi.doMock('astro:content', () => ({
			getCollection: vi.fn().mockImplementation(async (collection) => {
				if (collection !== 'blog') {
					return [];
				}

				// Return collection entries
				const entries = testFiles.map((file) => {
					const relativePath = path.relative(tempContentDir, file.path);
					const { title, date, permalink } = extractFrontmatter(file.content);
					return {
						id: relativePath,
						filePath: String(file.path),
						data: {
							title,
							date,
							permalink,
						},
					} as any;
				});

				return entries;
			}),
		}));
	});

	afterEach(() => {
		// Reset singleton instance after each test
		PathMapper.resetInstance();

		// Clean up test files
		if (fs.existsSync(tempContentDir)) {
			fs.rmSync(tempContentDir, { recursive: true, force: true });
		}

		vi.unmock('astro:content');
	});

	describe('Singleton Pattern', () => {
		it('should return same instance', async () => {
			const instance1 = await PathMapper.getInstance({ contentDir: tempContentDir });
			const instance2 = await PathMapper.getInstance({ contentDir: tempContentDir });

			expect(instance1).toBe(instance2);
		});

		it('should reset instance correctly', async () => {
			const instance1 = await PathMapper.getInstance({ contentDir: tempContentDir });
			PathMapper.resetInstance();
			const instance2 = await PathMapper.getInstance({ contentDir: tempContentDir });

			expect(instance1).not.toBe(instance2);
		});
	});

	describe('Permalink Resolution', () => {
		it('should resolve index page permalink', async () => {
			const mapper = await PathMapper.getInstance({ contentDir: tempContentDir });
			const indexPath = path.join(tempContentDir, 'index.md');
			const permalink = mapper.fileIdToPermalink(indexPath);

			expect(permalink).toBe('/');
		});

		it('should resolve regular post permalink', async () => {
			const mapper = await PathMapper.getInstance({ contentDir: tempContentDir });
			const testPath = path.join(tempContentDir, 'test.md');
			const permalink = mapper.fileIdToPermalink(testPath);

			expect(permalink).toBe('/test');
		});

		it('should resolve nested page permalink', async () => {
			const mapper = await PathMapper.getInstance({ contentDir: tempContentDir });
			const childPath = path.join(tempContentDir, 'nested', 'child.md');
			const permalink = mapper.fileIdToPermalink(childPath);

			expect(permalink).toBe('/nested/child');
		});

		it('should return null for non-existent file', async () => {
			const mapper = await PathMapper.getInstance({ contentDir: tempContentDir });
			const nonExistentPath = path.join(tempContentDir, 'nonexistent.md');
			const permalink = mapper.fileIdToPermalink(nonExistentPath);

			expect(permalink).toBeNull();
		});
	});

	describe('File Path Resolution', () => {
		it('should resolve root file path from permalink', async () => {
			const mapper = await PathMapper.getInstance({ contentDir: tempContentDir });
			const filePath = mapper.permalinkToFileId('/');

			expect(filePath).toBeDefined();
			expect(filePath).toContain('index.md');
		});

		it('should resolve nested file path from permalink', async () => {
			const mapper = await PathMapper.getInstance({ contentDir: tempContentDir });
			const filePath = mapper.permalinkToFileId('/test');

			expect(filePath).toBeDefined();
			expect(filePath).toContain('test.md');
		});

		it('should return null for non-existent permalink', async () => {
			const mapper = await PathMapper.getInstance({ contentDir: tempContentDir });
			const filePath = mapper.permalinkToFileId('/non-existent');

			expect(filePath).toBeNull();
		});
	});

	describe('Metadata Retrieval', () => {
		it('should return metadata for file path', async () => {
			const mapper = await PathMapper.getInstance({ contentDir: tempContentDir });
			const testPath = path.join(tempContentDir, 'test.md');
			const metadata = mapper.getFileMetadata(testPath);

			expect(metadata).toBeDefined();
			expect(metadata?.title).toBe('Test Post');
			expect(metadata?.permalink).toBe('/test');
			expect(metadata?.type).toBe('content');
			expect(metadata?.folderPath).toBe('');
		});

		it('should return metadata for index file', async () => {
			const mapper = await PathMapper.getInstance({ contentDir: tempContentDir });
			const indexPath = path.join(tempContentDir, 'index.md');
			const metadata = mapper.getFileMetadata(indexPath);

			expect(metadata).toBeDefined();
			expect(metadata?.title).toBe('Test Index');
			expect(metadata?.permalink).toBe('/');
			expect(metadata?.type).toBe('index');
			expect(metadata?.folderPath).toBe('');
		});

		it('should return metadata for nested index file', async () => {
			const mapper = await PathMapper.getInstance({ contentDir: tempContentDir });
			const indexPath = path.join(tempContentDir, 'nested', 'index.md');
			const metadata = mapper.getFileMetadata(indexPath);

			expect(metadata).toBeDefined();
			expect(metadata?.title).toBe('Nested Index');
			expect(metadata?.permalink).toBe('/nested');
			expect(metadata?.type).toBe('index');
			expect(metadata?.folderPath).toBe('nested');
		});

		it('should return metadata for permalink', async () => {
			const mapper = await PathMapper.getInstance({ contentDir: tempContentDir });
			const metadata = mapper.getFileMetadataByPermalink('/test');

			expect(metadata).toBeDefined();
			expect(metadata?.title).toBe('Test Post');
			expect(metadata?.permalink).toBe('/test');
		});

		it('should return null for non-existent file path', async () => {
			const mapper = await PathMapper.getInstance({ contentDir: tempContentDir });
			const nonExistentPath = path.join(tempContentDir, 'nonexistent.md');
			const metadata = mapper.getFileMetadata(nonExistentPath);

			expect(metadata).toBeNull();
		});

		it('should return null for non-existent permalink', async () => {
			const mapper = await PathMapper.getInstance({ contentDir: tempContentDir });
			const metadata = mapper.getFileMetadataByPermalink('/non-existent');

			expect(metadata).toBeNull();
		});
	});

	describe('Folder Metadata', () => {
		it('should return folder metadata for root', async () => {
			const mapper = await PathMapper.getInstance({ contentDir: tempContentDir });
			const folderMeta = mapper.getFolderMetadata('');

			expect(folderMeta).toBeDefined();
			expect(folderMeta?.hasIndex).toBe(true);
			expect(folderMeta?.fileIds.length).toBeGreaterThan(0);
		});

		it('should return folder metadata for nested folder', async () => {
			const mapper = await PathMapper.getInstance({ contentDir: tempContentDir });
			const folderMeta = mapper.getFolderMetadata('nested');

			expect(folderMeta).toBeDefined();
			expect(folderMeta?.hasIndex).toBe(true);
			expect(folderMeta?.fileIds.length).toBe(1);
		});

		it('should return folder metadata for folder without index', async () => {
			const mapper = await PathMapper.getInstance({ contentDir: tempContentDir });
			const folderMeta = mapper.getFolderMetadata('nonexistent');

			expect(folderMeta).toBeNull();
		});

		it('should include folder permalink when index exists', async () => {
			const mapper = await PathMapper.getInstance({ contentDir: tempContentDir });
			const folderMeta = mapper.getFolderMetadata('nested');

			expect(folderMeta?.permalink).toBe('/nested');
			expect(folderMeta?.title).toBe('Nested Index');
		});
	});

	describe('File Tree', () => {
		it('should return file tree', async () => {
			const mapper = await PathMapper.getInstance({ contentDir: tempContentDir });
			const tree = mapper.getFileTree();

			expect(tree).toBeDefined();
			expect(tree.size).toBeGreaterThan(0);
		});

		it('should contain root node', async () => {
			const mapper = await PathMapper.getInstance({ contentDir: tempContentDir });
			const tree = mapper.getFileTree();

			expect(tree.has('')).toBe(true);
		});

		it('should contain nested folders', async () => {
			const mapper = await PathMapper.getInstance({ contentDir: tempContentDir });
			const tree = mapper.getFileTree();

			expect(tree.has('nested')).toBe(true);
		});
	});

	describe('Build Status', () => {
		it('should report as ready after building', async () => {
			const mapper = await PathMapper.getInstance({ contentDir: tempContentDir });
			expect(mapper.isReady()).toBe(true);
		});
	});

	describe('Index File Special Handling', () => {
		it('should treat index.md folderPath as parent folder path', async () => {
			const mapper = await PathMapper.getInstance({ contentDir: tempContentDir });
			const indexPath = path.join(tempContentDir, 'index.md');
			const metadata = mapper.getFileMetadata(indexPath);

			// index.md should have folderPath as empty string for root
			expect(metadata?.folderPath).toBe('');
		});

		it('should treat nested index.md folderPath correctly', async () => {
			const mapper = await PathMapper.getInstance({ contentDir: tempContentDir });
			const indexPath = path.join(tempContentDir, 'nested', 'index.md');
			const metadata = mapper.getFileMetadata(indexPath);

			// nested index.md should have folderPath as 'nested' (without /index.md)
			expect(metadata?.folderPath).toBe('nested');
		});
	});

	describe('Data Consistency', () => {
		it('should have consistent bidirectional mapping for all files', async () => {
			const mapper = await PathMapper.getInstance({ contentDir: tempContentDir });

			// For every relativePath -> permalink, permalink -> relativePath should work
			const allFiles = mapper.getAllFiles();
			for (const file of allFiles) {
				const permalink = mapper.relativePathToPermalink(file.relativePath);
				expect(permalink).not.toBeNull();
				expect(permalink).toBe(file.permalink);

				const reversedPath = mapper.permalinkToRelativePath(permalink);
				expect(reversedPath).toBe(file.relativePath);
			}
		});
	});
});

// Helper function to extract frontmatter from file content
function extractFrontmatter(content: string): { title: string; date: Date; permalink: string } {
	const match = content.match(/^---\n([\s\S]*?)\n---/);
	if (!match) {
		return { title: 'Untitled', date: new Date(), permalink: '/' };
	}

	const frontmatter = match[1];
	const lines = frontmatter.split('\n');
	const result: { title: string; date: Date; permalink: string } = {
		title: 'Untitled',
		date: new Date(),
		permalink: '/',
	};

	for (const line of lines) {
		const titleMatch = line.match(/^title:\s*(.+)$/);
		if (titleMatch) {
			result.title = titleMatch[1].trim();
		} else if (line.startsWith('date:')) {
			result.date = new Date(line.slice(5).trim());
		} else if (line.startsWith('permalink:')) {
			result.permalink = line.slice(10).trim();
		}
	}

	return result;
}
