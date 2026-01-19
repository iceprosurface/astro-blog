import { visit } from 'unist-util-visit';
import { PathMapper } from '../utils/path-mapper/path-mapper.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Rehype plugin to resolve internal links
 * 这个插件在 HTML AST (hast) 阶段处理，比在 markdown AST 阶段更直接
 */
export default function rehypeResolveInternalLinks(options = {}) {
    const contentDir = options.contentDir || 'src/content/blog';

    return async (tree, file) => {
        const mapper = await PathMapper.getInstance({ contentDir });

        if (!mapper?.isReady()) {
            console.warn('PathMapper not ready, skipping link resolution');
            return;
        }

        const currentFilePath = file.path || file.history?.[0];
        if (!currentFilePath) {
            console.warn('No file path available');
            return;
        }

        // 将绝对路径转为相对路径
        const relativePath = toRelativePath(currentFilePath, contentDir);
        if (!relativePath) {
            return;
        }

        const currentFileMeta = mapper.getFileMetadataByRelativePath(relativePath);
        if (!currentFileMeta) {
            console.warn(`Cannot find metadata for: ${relativePath}`);
            return;
        }

        const currentFolderPath = currentFileMeta.folderPath;

        // 访问所有 a 元素
        visit(tree, 'element', (node) => {
            if (node.tagName !== 'a') return;

            const href = node.properties?.href;
            if (!href || typeof href !== 'string') return;

            // 跳过外部链接和特殊协议
            if (
                href.startsWith('http://') ||
                href.startsWith('https://') ||
                href.startsWith('#') ||
                href.startsWith('mailto:')
            ) {
                return;
            }

            // 分离路径和 hash
            const [pathPart, hashPart] = href.split('#');
            const hash = hashPart ? '#' + hashPart : '';

            // URL 解码
            let decodedPathPart;
            try {
                decodedPathPart = decodeURI(pathPart);
            } catch (e) {
                decodedPathPart = pathPart;
            }

            // 解析链接路径
            const targetPermalink = resolveLinkPath(
                decodedPathPart,
                currentFolderPath,
                mapper
            );



            if (targetPermalink) {
                // 更新 href
                node.properties = node.properties || {};
                node.properties.href = targetPermalink + hash;

                // 添加 internal 类名
                const className = node.properties.className;
                if (Array.isArray(className)) {
                    if (!className.includes('internal')) {
                        className.push('internal');
                    }
                } else if (typeof className === 'string') {
                    const classes = className.split(' ');
                    if (!classes.includes('internal')) {
                        node.properties.className = className + ' internal';
                    }
                } else {
                    node.properties.className = 'internal';
                }
            }
        });
    };
}

/**
 * 将绝对路径转换为相对于 contentDir 的相对路径
 */
function toRelativePath(absolutePath, contentDir) {
    if (!absolutePath || !contentDir) {
        return null;
    }

    const normalizedAbsolute = path.normalize(absolutePath);
    const normalizedContentDir = path.resolve(process.cwd(), contentDir);

    if (!normalizedAbsolute.startsWith(normalizedContentDir)) {
        return null;
    }

    let relativePath = normalizedAbsolute.slice(normalizedContentDir.length);

    if (relativePath.startsWith(path.sep)) {
        relativePath = relativePath.slice(1);
    }

    // 统一使用 posix 分隔符
    relativePath = relativePath.split(path.sep).join('/');

    return relativePath;
}

/**
 * 解析链接路径
 */
function resolveLinkPath(linkPath, currentFolderPath, mapper) {
    let normalizedLinkPath = linkPath;

    // 移除文件扩展名
    normalizedLinkPath = normalizedLinkPath.replace(/\.(md|mdx)$/, '');

    // 处理绝对路径
    if (linkPath.startsWith('/')) {
        normalizedLinkPath = linkPath.slice(1);
    }

    const segments = normalizedLinkPath.split('/').filter((s) => s.length > 0 && s !== '.');

    let startingFolderPath = currentFolderPath;

    if (linkPath.startsWith('/')) {
        startingFolderPath = '';
    } else {
        // 处理 ..
        let tempSegments = startingFolderPath ? startingFolderPath.split('/').filter(Boolean) : [];
        for (const seg of segments) {
            if (seg === '..') {
                tempSegments.pop();
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
    let targetMeta = mapper.findByRelativePath(targetRelativePath);

    // Fallback: Handle path starting with 'folder/' (Astro route)
    // If the user links to /folder/some/path, we should try to resolve 'some/path'
    const lowerTargetRelativePath = targetRelativePath.toLowerCase();
    if (!targetMeta && lowerTargetRelativePath.startsWith('folder/')) {
        const strippedPath = targetRelativePath.slice(7); // 'folder/'.length

        targetMeta = mapper.findByRelativePath(strippedPath);

        // Critical: Always update targetRelativePath to the stripped version
        // This ensures that if findByRelativePath fails (e.g. it's a folder not a file),
        // the subsequent folder lookups below will use the correct stripped path.
        targetRelativePath = strippedPath;
    }

    // Fallback: 如果直接找文件没找到，尝试处理 index 文件的情况
    // 例如: links to "archives/index" 但 archives/index.md 没有 permalink 被 path-mapper 忽略
    // 此时尝试查找 "archives" 文件夹
    if (!targetMeta) {
        let folderPath = null;
        if (targetRelativePath === 'index') {
            folderPath = '';
        } else if (targetRelativePath.endsWith('/index')) {
            folderPath = targetRelativePath.slice(0, -6); // remove '/index'
        }

        if (folderPath !== null) {
            targetMeta = mapper.getFolderMetadataFromRelativePath(folderPath);
        }
    }

    // Fallback 2: 直接尝试将其视为文件夹
    if (!targetMeta) {
        targetMeta = mapper.getFolderMetadataFromRelativePath(targetRelativePath);
    }

    if (targetMeta) {
        // 1. 如果有 permalink (文件或带 index 的文件夹)，直接使用
        if ('permalink' in targetMeta && targetMeta.permalink) {
            return targetMeta.permalink;
        }

        // 2. 如果是文件夹 或 index 文件但没有 permalink，构造默认 folder 链接
        // Use folderPath from metadata to ensure we link to the folder, not "folder/index"
        if (('subfolders' in targetMeta) || (targetMeta.type === 'index')) {
            const fPath = targetMeta.folderPath;
            return fPath ? '/folder/' + fPath : '/';
        }
    }

    return null;
}
