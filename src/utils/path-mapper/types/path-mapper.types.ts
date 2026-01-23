/**
 * PathMapper 核心类型定义
 *
 * 本文件定义了 PathMapper 系统的所有核心类型和接口
 * 设计原则：
 * - 相对路径作为唯一标识（canonical key）
 * - 不依赖文件系统操作
 * - 所有核心数据使用相对路径索引
 */

/**
 * 相对路径（相对于 content/blog 根目录）
 *
 * 规范（canonical 定义）：
 * - 使用 posix 路径分隔符 `/`
 * - 无前导 `/`（除了根路径返回空字符串）
 * - 保留扩展名 `.md` 或 `.mdx`
 * - 对 URI-encoded 路径进行 decodeURI（失败则保留原样）
 * - 移除多余的路径分隔符
 *
 * 示例:
 * - 首页: "index.md"
 * - 普通文件: "nested/file.md"
 * - 中文文件（URI 编码）: "知识库/设计模式.md"（存储为解码后的形式）
 *
 * 这是 PathMapper 的核心 canonical key，所有查询都应该使用此形式
 */
export type RelativePath = string;

/**
 * 文件路径作为唯一 ID（已废弃）
 *
 * 规范：
 * - 绝对路径（已解析 symlinks）
 * - 始终包含文件名和扩展名
 *
 * 示例:
 * - 首页: /Users/.../src/content/blog/index.md
 * - 普通文件: /Users/.../src/content/blog/nested/file.md
 *
 * ⚠️ **此类型已废弃，请使用 RelativePath 作为 canonical key**
 * 保留此类型仅用于 remark 插件的绝对路径转换
 */
export type FileId = string;

/**
 * 规范化的永久链接（URL 路径）
 *
 * 规范：
 * - 始终以 / 开头
 * - 不以 / 结尾（除了根路径 /）
 * - URL 编码特殊字符
 *
 * 示例:
 * - 首页: /
 * - 普通页面: /nested/file
 * - index.md 对应的文件夹: /nested
 * - 中文编码: /knowledge/programming/%E8%AE%BE%E8%AE%A1%E6%A8%A1%E5%BC%8F
 */
export type Permalink = string;

/**
 * 相对文件夹路径（相对于 content/blog 根目录）
 *
 * 规范：
 * - 不以 / 开头
 * - 使用 / 分隔路径段
 * - 根目录为空字符串
 *
 * 示例:
 * - 根目录: ""
 * - 嵌套文件夹: "nested/subfolder"
 */
export type FolderPath = string;

/**
 * 文件类型
 */
export type FileType = 'index' | 'content';

/**
 * 树节点类型
 */
export type NodeType = 'folder' | 'file' | 'index';

/**
 * 文件元数据
 *
 * 使用相对路径 (RelativePath) 作为唯一标识符
 */
export interface FileMetadata {
	/** 唯一标识：相对路径（canonical key） */
	fileId: RelativePath;

	/** 相对于 content/blog 根目录的路径（含文件名） */
	relativePath: RelativePath;

	/** 永久链接（规范化的 URL 路径） */
	permalink: Permalink;

	/** 页面标题 */
	title: string | null;

	/** 文件类型 */
	type: FileType;

	/**
	 * 文件夹路径（相对于 content/blog 根目录）
	 *
	 * 规则:
	 * - index.md: 父文件夹路径，不包含 /index.md
	 * - content 文件: 所在文件夹路径
	 * - 首页 index.md: ""（空字符串）
	 *
	 * 示例:
	 * - index.md → ""
	 * - nested/index.md → "nested"
	 * - nested/file.md → "nested"
	 */
	folderPath: FolderPath;

	/** 直接子文件 ID 列表（仅 index.md 类型有值） */
	childrenFileIds: RelativePath[];

	/** 前向链接（目标永久链接列表） */
	forwardLinks: Permalink[];

	/** 后向链接（引用此文件的永久链接列表） */
	backwardLinks: Permalink[];

	/** 文章标签列表 */
	tags: string[];
}

/**
 * 文件夹元数据
 *
 * 使用文件夹路径 (RelativePath) 作为唯一标识符
 */
export interface FolderMetadata {
	/** 文件夹相对路径（相对于 content/blog 根目录） */
	folderPath: RelativePath;

	/** 是否有 index.md 文件 */
	hasIndex: boolean;

	/** index.md 的文件 ID（如果存在） */
	indexFileId: RelativePath | null;

	/** 直接子文件夹路径列表（相对于 content/blog 根目录） */
	subfolders: RelativePath[];

	/** 直接子文件 ID 列表（排除 index.md） */
	fileIds: RelativePath[];

	/**
	 * 文件夹的永久链接（如果 index.md 有定义）
	 *
	 * 如果文件夹有永久链接，访问时必须使用此链接
	 */
	permalink: Permalink | null;

	/** 文件夹标题（来自 index.md 的 frontmatter） */
	title: string | null;
}

/**
 * 文件树节点
 *
 * 使用文件名作为 key，支持快速查找
 */
export interface TreeNode {
	/** 节点名称（文件夹名或文件名，不含扩展名） */
	name: string;

	/** 节点类型 */
	type: NodeType;

	/** 相关文件 ID（仅 file 和 index 类型） */
	fileId?: RelativePath;

	/** 相关文件夹路径（仅 folder 类型） */
	folderPath?: RelativePath;

	/** 子节点（仅 folder 类型） */
	children?: Map<string, TreeNode>;

	/** 永久链接（如果有） */
	permalink?: Permalink;

	/** 标题（如果有） */
	title?: string;
}

/**
 * 面包屑导航项
 */
export interface BreadcrumbItem {
	/** 显示标签 */
	label: string;

	/** 链接地址（空字符串表示无链接） */
	href: string;

	/** 是否为最后一项（当前页面） */
	isLast: boolean;
}

/**
 * 链接解析结果
 *
 * 所有链接解析函数返回统一的此结果类型
 */
export interface LinkResolutionResult {
	/** 解析是否成功 */
	success: boolean;

	/** 目标永久链接（如果成功） */
	permalink?: Permalink;

	/** 目标相对路径（如果成功） */
	relativePath?: RelativePath;

	/** 错误信息（如果失败） */
	error?: string;

	/** 使用的解析策略（用于调试） */
	strategy?: string;
}

/**
 * PathMapper 配置选项
 */
export interface PathMapperOptions {
	/** 内容目录路径（相对于项目根目录） */
	contentDir: string;

	/** 是否启用缓存 */
	enableCache?: boolean;

	/** 缓存文件路径（相对于项目根目录） */
	cachePath?: string;
}

/**
 * 链接解析策略枚举
 */
export enum LinkResolutionStrategy {
	/** 直接使用永久链接 */
	PERMALINK = 'permalink',

	/** 文件夹永久链接 */
	FOLDER_PERMALINK = 'folder-permalink',

	/** 文件夹 index.md 链接（/xxx/index.md） */
	FOLDER_INDEX = 'folder-index',

	/** 相对路径解析 */
	RELATIVE_PATH = 'relative-path',

	/** 文件名匹配 */
	FILENAME = 'filename',

	/** Wiki 链接解析 */
	WIKI_LINK = 'wiki-link',

	/** 绝对路径解析 */
	ABSOLUTE_PATH = 'absolute-path',
}

/**
 * 文件树查询结果
 */
export interface FileTreeQueryResult {
	/** 查询的节点 */
	node: TreeNode | null;

	/** 节点的完整路径（相对于 content/blog 根目录） */
	path: string | null;

	/** 错误信息（如果查询失败） */
	error?: string;
}

/**
 * 链接提取结果
 */
export interface LinkExtractionResult {
	/** 提取到的链接列表 */
	links: string[];

	/** 原始链接文本（带格式） */
	rawLinks: string[];
}
