import { fromHtml } from 'hast-util-from-html';
import { toHtml } from 'hast-util-to-html';
import { visit } from 'unist-util-visit';
import type { Element } from 'hast';
import path from 'path';
import type { PathMapper } from './path-mapper/path-mapper';

export interface ResolveLinksOptions {
    /**
     * 编译后的 HTML 内容
     */
    htmlContent: string;

    /**
     * 当前文件的相对路径（相对于 content 目录）
     */
    currentRelativePath: string;

    /**
     * PathMapper 实例
     */
    mapper: PathMapper;
}

/**
 * 解析 HTML 中的内部链接，将相对路径转换为 permalink
 */
export function resolveInternalLinks(options: ResolveLinksOptions): string {
    const { htmlContent, currentRelativePath, mapper } = options;

    // 解析 HTML 为 hast
    const tree = fromHtml(htmlContent, { fragment: true });

    // 获取当前文件的元数据
    const currentFileMeta = mapper.getFileMetadataByRelativePath(currentRelativePath);
    if (!currentFileMeta) {
        console.warn(`Cannot find metadata for file: ${currentRelativePath}`);
        return htmlContent;
    }

    const currentFolderPath = currentFileMeta.folderPath;

    // 访问所有 a 标签
    visit(tree, 'element', (node: Element) => {
        if (node.tagName !== 'a') return;

        const href = node.properties?.href;
        if (!href || typeof href !== 'string') return;

        // 跳过外部链接、锚点链接和特殊协议
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
        let decodedPathPart: string;
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
                if (!className.includes('internal')) {
                    node.properties.className = className + ' internal';
                }
            } else {
                node.properties.className = 'internal';
            }
        }
    });

    // 转换回 HTML
    return toHtml(tree, { allowDangerousHtml: true });
}

/**
 * 解析链接路径，将相对路径转换为 permalink
 */
function resolveLinkPath(
    linkPath: string,
    currentFolderPath: string,
    mapper: PathMapper
): string | null {
    let normalizedLinkPath = linkPath;

    // 移除文件扩展名（如果有）
    normalizedLinkPath = normalizedLinkPath.replace(/\.(md|mdx)$/, '');

    // 处理绝对路径（以 / 开头）
    if (linkPath.startsWith('/')) {
        normalizedLinkPath = linkPath.slice(1);
    }

    const segments = normalizedLinkPath.split('/').filter((s) => s.length > 0 && s !== '.');

    let startingFolderPath = currentFolderPath;

    // 如果是绝对路径，从根目录开始
    if (linkPath.startsWith('/')) {
        startingFolderPath = '';
    } else {
        // 处理相对路径中的 ..
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
        if (seg === '..') continue;
        if (seg === '.') continue;

        if (targetRelativePath) {
            targetRelativePath += '/' + seg;
        } else {
            targetRelativePath = seg;
        }
    }

    // 查找目标文件
    let targetMeta = mapper.findByRelativePath(targetRelativePath);

    // Fallback: 如果直接找文件没找到，尝试处理 index 文件的情况
    if (!targetMeta) {
        let folderPath: string | null = null;
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
        if (('subfolders' in targetMeta) || ('type' in targetMeta && targetMeta.type === 'index')) {
            const fPath = targetMeta.folderPath;
            const link = fPath ? '/folder/' + fPath : '/';
            return link.endsWith('/') ? link : `${link}/`;
        }
    }

    return null;
}
