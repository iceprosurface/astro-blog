
import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ params, request }) => {
    const id = params.id;

    if (!id) {
        return new Response('Missing ID', { status: 400 });
    }

    const posts = await getCollection('blog');
    const post = posts.find((p) => p.id === id);

    if (!post) {
        return new Response('Post not found', { status: 404 });
    }

    // Determine if we should return JSON or plain text. 
    // User asked for "raw markdown txt", so plain text is appropriate.
    // We might want to include frontmatter?
    // post.body is just the content body (excluding frontmatter).
    // If the user wants the "file content" to copy, usually they mean the body.
    // If they want the WHOLE file including frontmatter, we'd need to read the file.
    // But we have post.body. Let's return post.body for now.

    return new Response(post.body, {
        status: 200,
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
        }
    });
}

export async function getStaticPaths() {
    const posts = await getCollection('blog');
    return posts
        .filter((post) => {
            // Filter out ids that would cause directory/file conflicts
            // i.e. if we have "foo" and "foo/bar", we cannot generate a file for "foo"
            // because "foo" must be a directory to contain "bar".
            const isParentOfOther = posts.some(p => p.id.startsWith(post.id + '/'));
            return !isParentOfOther;
        })
        .map((post) => ({
            params: { id: post.id },
        }));
}
