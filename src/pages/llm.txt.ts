
import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';
import { SITE_TITLE, SITE_DESCRIPTION } from '../consts';

export const GET: APIRoute = async (context) => {
    const posts = (await getCollection('blog')).sort(
        (a, b) => {
            const dateA = a.data.date?.valueOf() ?? 0;
            const dateB = b.data.date?.valueOf() ?? 0;
            return dateB - dateA;
        }
    );

    const siteUrl = context.site?.toString() ?? 'https://iceprosurface.com';

    let content = `# ${SITE_TITLE}\n`;
    content += `${SITE_DESCRIPTION}\n\n`;
    content += `## Blog Posts\n\n`;

    for (const post of posts) {
        if (post.data.draft) continue;

        const permalink = post.data.permalink || `/blog/${post.id}/`;
        const fullUrl = new URL(permalink, siteUrl).toString();
        const rawUrl = new URL(`/api/raw/${post.id}`, siteUrl).toString();

        content += `### ${post.data.title}\n`;
        content += `- Date: ${post.data.date ? post.data.date.toLocaleDateString('en-CA') : 'Unknown'}\n`;
        if (post.data.description) {
            content += `- Description: ${post.data.description}\n`;
        }
        content += `- URL: ${fullUrl}\n`;
        content += `- Raw Content: ${rawUrl}\n`;
        content += `\n`;
    }

    return new Response(content, {
        status: 200,
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
        }
    });
}
