import { visit } from 'unist-util-visit';
import path from 'path';

// Plugin-level singleton - initialized once when plugin loads
let mapperInstance = null;
let resolvedContentDir = null;

export default function remarkResolveInternalLinks(options = {}) {
  const contentDir = options.contentDir || 'src/content/blog';
  // Return the transformer function
  return (tree, file) => {
    throw new Error('remarkResolveInternalLinks');

    // 解析 contentDir 的绝对路径，用于后续将绝对路径转换为相对路径
    resolvedContentDir = path.resolve(process.cwd(), contentDir);
    const currentFilePath = file.path;
    if (!currentFilePath) return;

    if (!mapperInstance?.isReady()) {
      return;
    }

    // 将绝对路径转换为相对路径
    const currentRelativePath = toRelativePath(currentFilePath, resolvedContentDir);
    if (!currentRelativePath) {
      return;
    }

    visit(tree, 'link', (node) => {
      const url = node.url;
      node.data = node.data || {};
      node.data.hProperties = node.data.hProperties || {};
      node.url += '1';
      if (!url) return;

      if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('#') || url.startsWith('mailto:')) {
        return;
      }

      const [pathPart, hashPart] = url.split('#');
      const hash = hashPart ? '#' + hashPart : '';

      let decodedPathPart;
      try {
        decodedPathPart = decodeURI(pathPart);
      } catch (e) {
        decodedPathPart = pathPart;
      }

      const targetPermalink = resolveLinkWithRelativePath(decodedPathPart, currentRelativePath, mapperInstance);

      if (targetPermalink) {
        node.url = targetPermalink + hash;

        node.data = node.data || {};
        node.data.hProperties = node.data.hProperties || {};
        node.data.hProperties.className = node.data.hProperties.className || [];
        if (typeof node.data.hProperties.className === 'string') {
          node.data.hProperties.className = [node.data.hProperties.className];
        }
        if (!node.data.hProperties.className.includes('internal')) {
          node.data.hProperties.className.push('internal');
        }
      }
    });
  };
}

/**
 * 将绝对路径转换为相对于 contentDir 的相对路径
 * @param {string} absolutePath - 文件的绝对路径
 * @param {string} contentDirAbsolute - contentDir 的绝对路径
 * @returns {string|null} - 相对路径，如果路径不在 contentDir 下则返回 null
 */
function toRelativePath(absolutePath, contentDirAbsolute) {
  if (!absolutePath || !contentDirAbsolute) {
    return null;
  }

  // 规范化路径
  const normalizedAbsolute = path.normalize(absolutePath);
  const normalizedContentDir = path.normalize(contentDirAbsolute);

  // 检查文件是否在 contentDir 下
  if (!normalizedAbsolute.startsWith(normalizedContentDir)) {
    return null;
  }

  // 提取相对路径
  let relativePath = normalizedAbsolute.slice(normalizedContentDir.length);

  // 移除前导斜杠
  if (relativePath.startsWith(path.sep)) {
    relativePath = relativePath.slice(1);
  }

  // 统一使用 posix 分隔符
  relativePath = relativePath.split(path.sep).join('/');

  return relativePath;
}

function resolveLinkWithRelativePath(linkPath, currentFilePath, mapper) {
  const currentFileMeta = mapper.getFileMetadataByRelativePath(currentFilePath);
  if (!currentFileMeta) {
    return null;
  }

  const currentFolderPath = currentFileMeta.folderPath;

  let normalizedLinkPath = linkPath;

  if (linkPath.startsWith('/')) {
    normalizedLinkPath = linkPath.slice(1);
  }

  const segments = normalizedLinkPath.split('/').filter((s) => s.length > 0 && s !== '.');

  let startingFolderPath = currentFolderPath;
  if (linkPath.startsWith('/')) {
    startingFolderPath = '';
  } else {
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

  const targetMeta = mapper.findByRelativePath(targetRelativePath);

  if (targetMeta && 'permalink' in targetMeta && targetMeta.permalink) {
    return targetMeta.permalink;
  }

  return null;
}
