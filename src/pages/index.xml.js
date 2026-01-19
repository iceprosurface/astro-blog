// Astro RSS 实现参考
// 将此文件放在 Astro 项目的 src/pages/ 目录下

import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

/**
 * 标准 RSS - 最近 15 条文章
 * URL: /index.xml
 */
export async function GET(context) {
  const posts = await getCollection('blog', ({ data }) => {
    return !data.draft && !data['no-rss'] && data.title && data.date && data.permalink; // 过滤草稿和无效项
  });

  // 按日期倒序排序，取前 15 条
  const sortedPosts = posts
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
    .slice(0, 15);

  return rss({
    title: 'Icepro 的博客',
    description: '知识库与技术分享',
    site: context.site,
    items: sortedPosts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.date,
      link: post.data.permalink,
      description: post.data.description || '阅读更多...',
      categories: post.data.tags || [],
    })),
    customData: `
      <language>zh-cn</language>
      <follow_challenge>
        <feedId>52340201851637774</feedId>
        <userId>68901958086173696</userId>
      </follow_challenge>
    `,
  });
}
