// Astro 全文 RSS 实现参考
// 将此文件放在 Astro 项目的 src/pages/ 目录下

import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import sanitizeHtml from 'sanitize-html';
import MarkdownIt from 'markdown-it';

const parser = new MarkdownIt();

// 自定义 mermaid 渲染逻辑：将其转换为 mermaid.ink 的图片链接
const defaultFence = parser.renderer.rules.fence;
parser.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const lang = token.info.trim();
  if (lang === 'mermaid') {
    const code = token.content.trim();
    // 使用 mermaid.ink 服务，由于 RSS 不支持 JS，转换为图片是最佳方案
    // 这里使用简单的 base64 编码方式
    const encoded = Buffer.from(JSON.stringify({ code, mermaid: { theme: 'default' } })).toString('base64');
    return `<p><img src="https://mermaid.ink/svg/${encoded}" alt="Mermaid diagram" /></p>`;
  }
  return defaultFence(tokens, idx, options, env, self);
};

/**
 * 全文 RSS - 所有文章
 * URL: /rss-full.xml
 */
export async function GET(context) {
  const posts = await getCollection('blog', ({ data }) => {
    const noRss = data['no-rss'] || data.noRss;
    return !data.draft && !noRss && data.title && data.date && data.permalink;
  });

  // 按日期倒序排序
  const sortedPosts = posts
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  return rss({
    title: 'Icepro 的博客 - 完整版',
    description: '所有文章的全文订阅源',
    site: context.site,
    stylesheet: '/rss.xsl',
    items: sortedPosts.map((post) => {
      const html = sanitizeHtml(parser.render(post.body || ''), {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
        allowedAttributes: {
          ...sanitizeHtml.defaults.allowedAttributes,
          img: ['src', 'alt', 'title'],
        },
      });

      // 修复相对链接：将 src/href 中的相对路径转换为绝对路径
      const postUrl = new URL(post.data.permalink, context.site).href;
      const fixedHtml = html.replace(
        /(src|href)="([^"]+)"/g,
        (match, attr, url) => {
          if (url.startsWith('http') || url.startsWith('//') || url.startsWith('mailto:') || url.startsWith('#')) {
            return match;
          }
          try {
            return `${attr}="${new URL(url, postUrl).href}"`;
          } catch (e) {
            return match;
          }
        }
      );

      return {
        title: post.data.title,
        pubDate: post.data.date,
        link: post.data.permalink,
        content: fixedHtml,
        categories: post.data.tags || [],
      };
    }),
    customData: `
      <language>zh-cn</language>
      <follow_challenge>
        <feedId>52340201851637774</feedId>
        <userId>68901958086173696</userId>
      </follow_challenge>
    `,
  });
}
