/**
 * PathMapper 核心类 - 基于 RelativePath
 *
 * 职责：
 * - 管理相对路径映射表（相对路径 ↔ permalink）
 * - 管理所有文件和文件夹的元数据
 * - 提供基于相对路径的查询接口（O(1) 查找）
 * - 不依赖文件系统操作
 *
 * 设计原则：
 * - 相对路径作为 canonical key（RelativePath）
 * - 所有核心数据使用相对路径索引
 * - 不提供绝对路径兼容层
 */

import type {
	RelativePath,
	Permalink,
	FolderPath,
	FileMetadata,
	FolderMetadata,
	TreeNode,
	BreadcrumbItem,
	PathMapperOptions,
} from './types/path-mapper.types';

/**
 * PathMapper 核心类 - 基于相对路径的数据管理
 */
export class PathMapper {
	private static instance: PathMapper | null = null;

	// ==================== 核心索引（canonical key: RelativePath）====================

	// 相对路径 -> 文件元数据
	private relativePathToMetadata: Map<RelativePath, FileMetadata> = new Map();

	// 相对路径 -> 文件夹元数据
	private relativePathToFolderMeta: Map<RelativePath, FolderMetadata> = new Map();

	// ==================== Permalink 映射 ====================

	private _permalinkToRelativePath: Map<Permalink, RelativePath> = new Map();
	private _relativePathToPermalink: Map<RelativePath, Permalink> = new Map();

	// ==================== 文件树（可选）====================

	private fileTree: Map<string, TreeNode> = new Map();

	// ==================== 状态管理 ====================

	private options: PathMapperOptions;
	private isBuilt = false;

	private constructor(options: PathMapperOptions) {
		this.options = options;
	}

	/**
	 * 获取单例实例
	 */
	static async getInstance(options: PathMapperOptions): Promise<PathMapper> {
		if (!this.instance) {
			this.instance = new PathMapper(options);
			await this.instance.build();
		}
		return this.instance;
	}

	/**
	 * 重置实例（用于测试）
	 */
	static resetInstance(): void {
		PathMapper.instance = null;
	}

	/**
	 * 构建所有数据结构（主流程）
	 */
	async build(): Promise<void> {
		if (this.isBuilt) {
			return;
		}

		try {
			// 加载 Astro content collection
			let getCollection;
			try {
				const astroContent = await import('astro:content');
				getCollection = astroContent.getCollection;
			} catch {
				return;
			}

			const allPosts = await getCollection('blog');

			// Pass 1: 构建相对路径映射表和文件元数据
			this.buildRelativePathMappings(allPosts);

			// Pass 2: 构建文件夹元数据
			this.buildFolderMetadata();

			// Pass 3: 构建文件树
			this.buildFileTree();

			// Pass 4: 构建链接映射（forwardLinks 和 backwardLinks）
			await this.buildLinkMappings(allPosts);

			this.isBuilt = true;
		} catch (error) {
			throw error;
		}
	}

	// ==================== 面包屑导航接口 ====================

	/**
	 * 获取指定文件的面包屑导航数据
	 * @param relativePath 文件的相对路径
	 */
	getBreadcrumbs(relativePath: RelativePath): BreadcrumbItem[] {
		const normalized = PathMapper.normalizeRelativePath(relativePath);
		const breadcrumbs: BreadcrumbItem[] = [];

		// 1. 添加首页
		breadcrumbs.push({
			label: 'Home',
			href: '/',
			isLast: normalized === '',
		});

		if (normalized === '') {
			return breadcrumbs;
		}

		// 2. 获取当前文件元数据
		const fileMeta = this.relativePathToMetadata.get(normalized);
		if (!fileMeta) {
			return breadcrumbs;
		}

		const folderPath = fileMeta.folderPath;
		const segments = folderPath ? folderPath.split('/').filter(Boolean) : [];
		let accumulated = '';

		// 3. 处理文件夹路径
		for (let i = 0; i < segments.length; i++) {
			const segment = segments[i];
			accumulated += (accumulated ? '/' : '') + segment;
			const isLastSegment = i === segments.length - 1;

			// 如果当前文件是 index 类型，且当前段是最后一个，则是当前页
			if (fileMeta.type === 'index' && isLastSegment) {
				breadcrumbs.push({
					label: fileMeta.title || segment,
					href: '',
					isLast: true,
				});
				return breadcrumbs;
			}

			// 尝试获取文件夹元数据
			let foundLink: string | null = null;
			let foundLabel: string | null = null;

			const folderMeta = this.relativePathToFolderMeta.get(accumulated);
			if (folderMeta && folderMeta.permalink) {
				foundLink = folderMeta.permalink;
				foundLabel = folderMeta.title;
			} else {
				// Fallback 1: 尝试直接查找 index.md 或 index.mdx
				const indexMd = this.relativePathToMetadata.get(`${accumulated}/index.md`);
				const indexMdx = !indexMd ? this.relativePathToMetadata.get(`${accumulated}/index.mdx`) : null;
				const indexMeta = indexMd || indexMdx;

				if (indexMeta && indexMeta.permalink) {
					foundLink = indexMeta.permalink;
					foundLabel = indexMeta.title;
				} else {
					// Fallback 2: 都没有则指向 folder 页面
					foundLink = `/folder/${accumulated}`;
					foundLabel = segment;
				}
			}

			breadcrumbs.push({
				label: foundLabel || segment,
				href: foundLink || '',
				isLast: false,
			});
		}

		// 4. 添加当前文件（如果是 content 类型）
		if (fileMeta.type !== 'index') {
			breadcrumbs.push({
				label: fileMeta.title || fileMeta.relativePath.split('/').pop() || '',
				href: '',
				isLast: true,
			});
		}

		return breadcrumbs;
	}

	// ==================== 核心查询接口（基于 RelativePath）====================

	/**
	 * 通过相对路径获取文件元数据（精确匹配）
	 */
	getFileMetadataByRelativePath(relativePath: RelativePath): FileMetadata | null {
		const normalized = PathMapper.normalizeRelativePath(relativePath);
		return this.relativePathToMetadata.get(normalized) || null;
	}

	/**
	 * 通过相对路径查找（支持自动补扩展名、folder index 等）
	 */
	findByRelativePath(relativePath: RelativePath): FileMetadata | FolderMetadata | null {
		const normalized = PathMapper.normalizeRelativePath(relativePath);

		// 策略 1: 精确匹配文件
		let result = this.relativePathToMetadata.get(normalized);
		if (result) {
			return result;
		}

		// 策略 2: 补扩展名 .md
		result = this.relativePathToMetadata.get(`${normalized}.md`);
		if (result) {
			return result;
		}

		// 策略 3: 补扩展名 .mdx
		result = this.relativePathToMetadata.get(`${normalized}.mdx`);
		if (result) {
			return result;
		}

		// 策略 4: folder index（/index.md 或 /index.mdx）
		result = this.relativePathToMetadata.get(`${normalized}/index.md`);
		if (result) {
			return result;
		}

		result = this.relativePathToMetadata.get(`${normalized}/index.mdx`);
		if (result) {
			return result;
		}

		// 策略 5: 文件夹元数据
		const folderMeta = this.relativePathToFolderMeta.get(normalized);
		if (folderMeta) {
			return folderMeta;
		}

		return null;
	}

	/**
	 * 通过相对路径获取文件夹元数据
	 */
	getFolderMetadataFromRelativePath(folderPath: RelativePath): FolderMetadata | null {
		const normalized = PathMapper.normalizeRelativePath(folderPath);
		return this.relativePathToFolderMeta.get(normalized) || null;
	}

	/**
	 * 通过相对路径获取文件夹元数据（别名）
	 * @deprecated 使用 getFolderMetadataFromRelativePath 替代
	 */
	getFolderMetadata(folderPath: FolderPath): FolderMetadata | null {
		return this.getFolderMetadataFromRelativePath(folderPath);
	}

	// ==================== Permalink 查询接口 ====================

	/**
	 * 永久链接 -> 相对路径
	 */
	permalinkToRelativePath(permalink: Permalink): RelativePath | null {
		const normalized = PathMapper.normalizePermalink(permalink);
		return this._permalinkToRelativePath.get(normalized) || null;
	}

	/**
	 * 相对路径 -> 永久链接
	 */
	relativePathToPermalink(relativePath: RelativePath): Permalink | null {
		const normalized = PathMapper.normalizeRelativePath(relativePath);
		return this._relativePathToPermalink.get(normalized) || null;
	}

	/**
	 * 通过永久链接获取文件元数据
	 */
	getFileMetadataByPermalink(permalink: Permalink): FileMetadata | null {
		const relativePath = this.permalinkToRelativePath(permalink);
		if (!relativePath) return null;
		return this.relativePathToMetadata.get(relativePath) || null;
	}

	// ==================== 辅助方法 ====================

	/**
	 * 获取所有文件元数据
	 */
	getAllFiles(): FileMetadata[] {
		return Array.from(this.relativePathToMetadata.values());
	}

	/**
	 * 获取所有文件夹元数据
	 */
	getAllFolders(): FolderMetadata[] {
		return Array.from(this.relativePathToFolderMeta.values());
	}

	/**
	 * 获取文件树
	 */
	getFileTree(): Map<string, TreeNode> {
		return new Map(this.fileTree);
	}

	/**
	 * 检查是否已构建
	 */
	isReady(): boolean {
		return this.isBuilt;
	}

	// ==================== 内部构建方法 ====================

	/**
	 * 规范化相对路径
	 */
	public static normalizeRelativePath(pathStr: string): RelativePath {
		// 1. URL decode（处理 URI-encoded 路径）
		let decoded = pathStr;
		try {
			decoded = decodeURI(pathStr);
		} catch {
			// decode 失败，保留原样
		}

		// 2. 统一使用 posix 分隔符
		let normalized = decoded.replace(/\\/g, '/');

		// 3. 移除前导 /
		if (normalized.startsWith('/')) {
			normalized = normalized.slice(1);
		}

		// 4. 移除尾部 /
		if (normalized.endsWith('/')) {
			normalized = normalized.slice(0, -1);
		}

		// 5. 压缩多个分隔符
		normalized = normalized.replace(/\/+/g, '/');

		// 6. 空格转换为 -
		normalized = normalized.replaceAll(' ', '-')

		// 7. 全部转化为小写
		normalized = normalized.toLowerCase()

		return normalized || '';  // 根路径返回空字符串
	}

	/**
	 * 规范化永久链接
	 */
	private static normalizePermalink(permalink: string): Permalink {
		const trimmed = permalink.trim();
		if (trimmed === '' || trimmed === '/') {
			return '/';
		}

		const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
		return withLeadingSlash.endsWith('/') ? withLeadingSlash.slice(0, -1) : withLeadingSlash;
	}

	/**
	 * 解析相对路径（类似 path.resolve，防止路径穿越）
	 */
	private resolveRelativePath(baseRelativePath: RelativePath, linkPath: string): RelativePath | null {
		let normalizedLink = PathMapper.normalizeRelativePath(linkPath);

		// 处理绝对路径（以 / 开头）
		if (linkPath.startsWith('/')) {
			return normalizedLink;
		}

		// 处理相对路径
		const baseParts = baseRelativePath ? baseRelativePath.split('/').filter(Boolean) : [];
		const linkParts = normalizedLink.split('/').filter(Boolean);

		const resolvedParts: string[] = [];

		// 处理父目录引用
		for (const part of linkParts) {
			if (part === '..') {
				if (resolvedParts.length > 0) {
					resolvedParts.pop();
				} else {
					// 路径穿越到根目录之外，拒绝
					return null;
				}
			} else if (part !== '.') {
				resolvedParts.push(part);
			}
		}

		const resolvedPath = resolvedParts.join('/');
		return resolvedPath;
	}

	/**
	 * 构建相对路径映射表和文件元数据
	 */
	private buildRelativePathMappings(allPosts: any[]): void {
		for (const post of allPosts) {
			// 直接使用 post.id 作为相对路径
			const relativePath = PathMapper.normalizeRelativePath(post.id);

			// 跳过没有 permalink 的文件
			const rawPermalink = post.data.permalink;
			if (!rawPermalink) {
				continue;
			}

			const normalizedPermalink = PathMapper.normalizePermalink(rawPermalink);

			// 解析路径
			const fileName = relativePath.split('/').pop() || '';
			const dirPath = relativePath.slice(0, -fileName.length).replace(/\/$/, '');
			const folderPath = dirPath || '';

			const isIndex = fileName === 'index.md' || fileName === 'index.mdx';

			// 构建文件元数据
			const metadata: FileMetadata = {
				fileId: relativePath,  // 现在 fileId 就是 relativePath
				relativePath,
				permalink: normalizedPermalink,
				title: post.data.title || null,
				type: isIndex ? 'index' : 'content',
				folderPath,
				childrenFileIds: [],
				forwardLinks: [],
				backwardLinks: [],
			};

			// 添加到核心索引
			this.relativePathToMetadata.set(relativePath, metadata);

			// 检查重复 permalink（首次写入赢）
			if (this._permalinkToRelativePath.has(normalizedPermalink)) {
				// 首次写入的保留，后续的忽略
			} else {
				this._permalinkToRelativePath.set(normalizedPermalink, relativePath);
				this._relativePathToPermalink.set(relativePath, normalizedPermalink);
			}
		}
	}

	/**
	 * 构建文件夹元数据
	 */
	private buildFolderMetadata(): void {
		// 按 folderPath 分组文件
		const folderToFileIds: Map<RelativePath, RelativePath[]> = new Map();

		for (const metadata of this.relativePathToMetadata.values()) {
			const { folderPath, fileId, type } = metadata;

			if (!folderToFileIds.has(folderPath)) {
				folderToFileIds.set(folderPath, []);
			}

			// 排除 index.md 从文件列表（它作为文件夹的入口）
			if (type !== 'index') {
				folderToFileIds.get(folderPath)!.push(fileId);
			}

			// 记录 index.md 到文件夹的映射 - 确保文件夹存在
			if (type === 'index') {
				if (!folderToFileIds.has(folderPath)) {
					folderToFileIds.set(folderPath, []);
				}
			}
		}

		// 扩展：确保所有中间路径和根路径都作为文件夹存在
		// 即使某个目录只有子目录没有文件，也需要作为 FolderMetadata 存在
		const allFolderPaths = new Set(folderToFileIds.keys());
		allFolderPaths.add('');

		// 根据现有的文件夹路径，补全所有父级路径
		const initialPaths = Array.from(allFolderPaths);
		for (const path of initialPaths) {
			let current = path;
			while (current.includes('/')) {
				current = current.substring(0, current.lastIndexOf('/'));
				if (current) {
					allFolderPaths.add(current);
				}
			}
		}

		// 构建文件夹元数据
		for (const folderPath of allFolderPaths) {
			const fileIds = folderToFileIds.get(folderPath) || [];

			// 查找 index.md
			const indexMetadata = Array.from(this.relativePathToMetadata.values()).find(
				(m) => m.type === 'index' && m.folderPath === folderPath,
			);

			// 查找子文件夹
			const subfolders: RelativePath[] = [];
			for (const subFolderPath of allFolderPaths) {
				if (!subFolderPath) continue; // Skip empty path (root) if iterating, but root is in set as ''
				if (subFolderPath === folderPath) continue;

				let isDirectChild = false;
				if (folderPath === '') {
					// 根目录的子文件夹：不能包含 /
					isDirectChild = !subFolderPath.includes('/');
				} else {
					// 其他目录：必须以 父目录+/ 开头，且剩余部分不包含 /
					if (subFolderPath.startsWith(folderPath + '/')) { // 加上 / 防止 partial match (e.g. arch -> archives)
						const rest = subFolderPath.slice(folderPath.length + 1);
						isDirectChild = !rest.includes('/');
					}
				}

				if (isDirectChild) {
					subfolders.push(subFolderPath);
				}
			}

			const folderMeta: FolderMetadata = {
				folderPath,
				hasIndex: !!indexMetadata,
				indexFileId: indexMetadata?.fileId || null,
				subfolders,
				fileIds: fileIds.filter((id) => {
					const meta = this.relativePathToMetadata.get(id);
					return meta && meta.type !== 'index';
				}),
				permalink: indexMetadata?.permalink || null,
				title: indexMetadata?.title || null,
			};

			this.relativePathToFolderMeta.set(folderPath, folderMeta);

			// 更新 index.md 的 children
			if (indexMetadata) {
				indexMetadata.childrenFileIds = fileIds.filter((id) => {
					const meta = this.relativePathToMetadata.get(id);
					return meta && meta.type !== 'index';
				});
			}
		}
	}

	/**
	 * 构建文件树
	 */
	private buildFileTree(): void {
		// 初始化空树
		const root: Map<string, TreeNode> = new Map();

		// 添加所有文件夹
		for (const [folderPath, folderMeta] of this.relativePathToFolderMeta.entries()) {
			const parts = folderPath === '' ? [] : folderPath.split('/').filter(Boolean);
			let currentLevel = root;

			for (const part of parts) {
				if (!currentLevel.has(part)) {
					currentLevel.set(part, { name: part, type: 'folder', children: new Map() });
				}
				const node = currentLevel.get(part)!;
				if (node.children) {
					currentLevel = node.children;
				}
			}

			if (folderPath === '' && !root.has('')) {
				root.set('', { name: '', type: 'folder', children: new Map() });
				currentLevel = root.get('')!.children!;
			}

			// 添加 index.md 节点
			if (folderMeta.hasIndex && folderMeta.indexFileId) {
				const indexMeta = this.relativePathToMetadata.get(folderMeta.indexFileId!);
				if (indexMeta) {
					const indexNode: TreeNode = {
						name: folderPath === '' ? 'root' : folderPath.split('/').pop() || '',
						type: 'index',
						fileId: indexMeta.fileId,
						folderPath,
						permalink: indexMeta.permalink,
						title: indexMeta.title ?? undefined,
					};
					currentLevel.set('index', indexNode);
				}
			}
		}

		// 添加所有文件（非 index.md）
		for (const metadata of this.relativePathToMetadata.values()) {
			if (metadata.type === 'index') continue;

			const folderPath = metadata.folderPath;
			const parts = folderPath.split('/').filter(Boolean);
			let currentLevel = root;

			for (const part of parts) {
				const node = currentLevel.get(part);
				if (node && node.children) {
					currentLevel = node.children;
				} else {
					break;
				}
			}

			// 添加文件节点
			const fileName = metadata.relativePath.split('/').pop() || '';
			const fileNode: TreeNode = {
				name: fileName.replace(/\.mdx?$/, ''),
				type: 'file',
				fileId: metadata.fileId,
				folderPath,
				permalink: metadata.permalink,
				title: metadata.title ?? undefined,
			};
			currentLevel.set(fileName, fileNode);
		}

		this.fileTree = root;
	}

	/**
	 * 构建链接映射（forwardLinks 和 backwardLinks）
	 */
	private async buildLinkMappings(allPosts: any[]): Promise<void> {
		// 动态导入 unified
		const { unified } = await import('unified');
		const remarkParse = (await import('remark-parse')).default;

		// 创建 markdown 解析器
		const parser = unified().use(remarkParse);

		// 存储所有文件的 forwardLinks 临时数据
		const forwardLinksMap = new Map<RelativePath, Set<Permalink>>();

		// Pass 1: 提取每个文件的所有内部链接
		for (const post of allPosts) {
			const relativePath = PathMapper.normalizeRelativePath(post.id);
			const metadata = this.relativePathToMetadata.get(relativePath);

			if (!metadata) continue;

			const folderPath = metadata.folderPath;
			const links = new Set<Permalink>();

			try {
				// 解析 markdown
				const tree = parser.parse(post.body || '');

				// 提取链接
				this.extractLinks(tree, folderPath, links);
			} catch (error) {
				console.error(`Failed to parse links for ${relativePath}:`, error);
			}

			forwardLinksMap.set(relativePath, links);
		}

		// Pass 2: 将 forwardLinks 写入 metadata，并构建 backwardLinks
		for (const [sourcePath, forwardLinks] of forwardLinksMap.entries()) {
			const sourceMetadata = this.relativePathToMetadata.get(sourcePath);

			if (!sourceMetadata) continue;

			// 设置 forwardLinks
			sourceMetadata.forwardLinks = Array.from(forwardLinks);

			// 为每个目标链接添加 backwardLinks
			for (const targetPermalink of forwardLinks) {
				const targetRelativePath = this._permalinkToRelativePath.get(targetPermalink);

				if (targetRelativePath) {
					const targetMetadata = this.relativePathToMetadata.get(targetRelativePath);

					if (targetMetadata) {
						if (!targetMetadata.backwardLinks.includes(sourceMetadata.permalink)) {
							targetMetadata.backwardLinks.push(sourceMetadata.permalink);
						}
					}
				}
			}
		}
	}

	/**
	 * 从 markdown AST 中提取内部链接
	 */
	private extractLinks(node: any, currentFolderPath: string, links: Set<Permalink>): void {
		if (!node) return;

		// 处理链接节点
		if (node.type === 'link' && node.url) {
			const url = node.url as string;

			// 跳过外部链接
			if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('#')) {
				return;
			}

			// 解析链接
			const targetPermalink = this.resolveLinkPath(url, currentFolderPath);

			if (targetPermalink) {
				links.add(targetPermalink);
			}
		}

		// 递归处理子节点
		if (node.children && Array.isArray(node.children)) {
			for (const child of node.children) {
				this.extractLinks(child, currentFolderPath, links);
			}
		}
	}

	/**
	 * 解析链接路径（与 rehype-resolve-internal-links 中的逻辑一致）
	 */
	private resolveLinkPath(linkPath: string, currentFolderPath: string): Permalink | null {
		let normalizedLink = linkPath;

		// 移除文件扩展名
		normalizedLink = normalizedLink.replace(/\.(md|mdx)$/, '');

		// 处理绝对路径（以 / 开头）
		if (linkPath.startsWith('/')) {
			normalizedLink = linkPath.slice(1);
		}

		const segments = normalizedLink.split('/').filter((s) => s.length > 0 && s !== '.');

		let startingFolderPath = currentFolderPath;

		if (linkPath.startsWith('/')) {
			startingFolderPath = '';
		} else {
			// 处理 ..
			let tempSegments = startingFolderPath ? startingFolderPath.split('/').filter(Boolean) : [];
			for (const seg of segments) {
				if (seg === '..') {
					if (tempSegments.length > 0) {
						tempSegments.pop();
					} else {
						// 路径穿越到根目录之外，拒绝
						return null;
					}
				} else {
					break;
				}
			}
			startingFolderPath = tempSegments.join('/');
		}

		// 构建目标路径
		let targetRelativePath = startingFolderPath;
		for (const seg of segments) {
			if (seg === '..' || seg === '.') continue;

			if (targetRelativePath) {
				targetRelativePath += '/' + seg;
			} else {
				targetRelativePath = seg;
			}
		}

		// 查找目标文件
		const targetMeta = this.findByRelativePath(targetRelativePath);

		if (targetMeta && 'permalink' in targetMeta && targetMeta.permalink) {
			return targetMeta.permalink;
		}

		return null;
	}
}
