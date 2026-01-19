const fs = require('fs');
const path = require('path');

const sitemapPath = path.join(__dirname, '../src/content/sitemap.xml');
const sitemapContent = fs.readFileSync(sitemapPath, 'utf-8');

const urlRegex = /<loc>(.*?)<\/loc>/g;
const urls = [];
let match;

while ((match = urlRegex.exec(sitemapContent)) !== null) {
  urls.push(match[1]);
}

console.log(`Found ${urls.length} URLs in sitemap`);

function parseFrontmatter(content) {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return null;
  }

  const frontmatterText = match[1];
  const result = {};

  frontmatterText.split('\n').forEach((line) => {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) return;

    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();

    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    } else if (value.startsWith('[') && value.endsWith(']')) {
      value = value.slice(1, -1).split(',').map((v) => v.trim().replace(/^['"]|['"]$/g, ''));
    }

    result[key] = value;
  });

  return result;
}

function collectMarkdownFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      collectMarkdownFiles(filePath, fileList);
    } else if (file.endsWith('.md') || file.endsWith('.mdx')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

function buildPermalinkMap() {
  const blogDir = path.join(__dirname, '../src/content/blog');
  const mdFiles = collectMarkdownFiles(blogDir);

  const permalinkMap = {};

  mdFiles.forEach((filePath) => {
    const content = fs.readFileSync(filePath, 'utf-8');
    const frontmatter = parseFrontmatter(content);

    if (frontmatter && frontmatter.permalink) {
      let permalink = frontmatter.permalink;

      if (permalink.startsWith('/')) {
        permalink = permalink.slice(1);
      }

      if (permalink.endsWith('/')) {
        permalink = permalink.slice(0, -1);
      }

      permalinkMap[filePath] = '/' + permalink;
    }
  });

  return permalinkMap;
}

function findMatchingPermalink(urlPath, permalinkMap) {
  const blogDir = path.join(__dirname, '../src/content/blog');
  const pathParts = urlPath.slice(1).split('/');
  const fileName = pathParts.pop();

  const dirPath = path.join(blogDir, ...pathParts);

  if (!fs.existsSync(dirPath)) {
    return null;
  }

  const files = fs.readdirSync(dirPath);

  const exactMatchFile = files.find((f) => f === fileName + '.md' || f === fileName + '.mdx');

  if (exactMatchFile) {
    const filePath = path.join(dirPath, exactMatchFile);

    if (permalinkMap[filePath]) {
      return permalinkMap[filePath];
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const frontmatter = parseFrontmatter(content);

    if (frontmatter && frontmatter.permalink) {
      let permalink = frontmatter.permalink;

      if (permalink.startsWith('/')) {
        permalink = permalink.slice(1);
      }

      if (permalink.endsWith('/')) {
        permalink = permalink.slice(0, -1);
      }

      return '/' + permalink;
    }

    return urlPath;
  }

  const variations = [
    fileName.replace(/-/g, ' '),
    fileName.replace(/--/g, ' '),
    fileName.replace(/_/g, ' '),
    fileName.replace(/&amp;/g, '&'),
    fileName.replace(/&/g, '& '),
  ];

  for (const variation of variations) {
    const matchedFile = files.find((f) => f === variation + '.md' || f === variation + '.mdx');

    if (matchedFile) {
      const filePath = path.join(dirPath, matchedFile);

      if (permalinkMap[filePath]) {
        return permalinkMap[filePath];
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const frontmatter = parseFrontmatter(content);

      if (frontmatter && frontmatter.permalink) {
        let permalink = frontmatter.permalink;

        if (permalink.startsWith('/')) {
          permalink = permalink.slice(1);
        }

        if (permalink.endsWith('/')) {
          permalink = permalink.slice(0, -1);
        }

        return '/' + permalink;
      }

      const matchedPath = '/' + [...pathParts, variation].join('/');
      return matchedPath;
    }
  }

  const escapedFileName = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regexPattern = new RegExp(
    '^' + escapedFileName.replace(/-/g, '[- ]+').replace(/_/g, '[_ ]+') + '\\.(md|mdx)$',
    'i',
  );
  const fuzzyMatch = files.find((f) => regexPattern.test(f));

  if (fuzzyMatch) {
    const filePath = path.join(dirPath, fuzzyMatch);

    if (permalinkMap[filePath]) {
      return permalinkMap[filePath];
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const frontmatter = parseFrontmatter(content);

    if (frontmatter && frontmatter.permalink) {
      let permalink = frontmatter.permalink;

      if (permalink.startsWith('/')) {
        permalink = permalink.slice(1);
      }

      if (permalink.endsWith('/')) {
        permalink = permalink.slice(0, -1);
      }

      return '/' + permalink;
    }

    const matchedPath = '/' + [...pathParts, fuzzyMatch.replace(/\.(md|mdx)$/, '')].join('/');
    return matchedPath;
  }

  return null;
}

console.log('Building permalink map from markdown files...');
const permalinkMap = buildPermalinkMap();
console.log(`Found ${Object.keys(permalinkMap).length} files with permalinks`);

const redirectMap = {};

urls.forEach((url) => {
  const decodedUrl = decodeURIComponent(url);
  const urlPath = decodedUrl.replace('https://iceprosurface.com', '');

  if (urlPath === '' || urlPath === '/') {
    return;
  }

  const matchedPermalink = findMatchingPermalink(urlPath, permalinkMap);

  if (matchedPermalink) {
    redirectMap[urlPath] = matchedPermalink;
    if (urlPath !== matchedPermalink) {
      console.log(`Redirect: ${urlPath} -> ${matchedPermalink}`);
    }
  } else {
    console.log(`Warning: File not found for URL: ${urlPath}`);
    redirectMap[urlPath] = null;
  }
});

const manualRedirectsPath = path.join(__dirname, '../src/manual-redirects.json');

if (fs.existsSync(manualRedirectsPath)) {
  const manualRedirects = JSON.parse(fs.readFileSync(manualRedirectsPath, 'utf-8'));

  console.log('\n=== Applying Manual Redirects ===');

  let manualCount = 0;

  for (const [source, target] of Object.entries(manualRedirects)) {
    if (redirectMap[source] === null || !redirectMap[source]) {
      redirectMap[source] = target;
      console.log(`Manual: ${source} -> ${target}`);
      manualCount++;
    } else if (redirectMap[source] !== target) {
      redirectMap[source] = target;
      console.log(`Manual override: ${source} -> ${target}`);
      manualCount++;
    }
  }

  console.log(`Applied ${manualCount} manual redirects`);
}

const totalUrls = urls.length;
const mappedUrls = Object.values(redirectMap).filter((v) => v !== null).length;
const unmappedUrls = Object.values(redirectMap).filter((v) => v === null).length;

console.log('\n=== Mapping Statistics ===');
console.log(`Total URLs in sitemap: ${totalUrls}`);
console.log(`Mapped URLs: ${mappedUrls}`);
console.log(`Unmapped URLs: ${unmappedUrls}`);

const jsonOutputPath = path.join(__dirname, '../src/redirects.json');
fs.writeFileSync(jsonOutputPath, JSON.stringify(redirectMap, null, 2), 'utf-8');
console.log(`JSON redirect map written to: ${jsonOutputPath}`);
