import type { APIRoute } from 'astro';

import { buildSnippetHtml, buildTitleHtml } from '../../utils/search/snippet';
import { getSearchIndexState } from '../../utils/search/search-index';

export const prerender = false;

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 50;

function normalizePermalink(permalink: string): string {
  const trimmed = permalink.trim();
  if (trimmed === '' || trimmed === '/') return '/';
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
}

function parseLimit(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(n)));
}

function dedupe<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

type SearchResponseItem = {
  permalink: string;
  title: string;
  titleHtml: string;
  snippetHtml: string;
  tags: string[];
  updatedTs?: number;
};

export const GET: APIRoute = async ({ url }) => {
  const qRaw = url.searchParams.get('q') ?? '';
  const q = qRaw.trim();

  if (q.length === 0) {
    return new Response(JSON.stringify({ items: [] }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  }

  const limit = parseLimit(url.searchParams.get('limit'));
  const modeParam = (url.searchParams.get('mode') ?? '').trim();
  const isTagMode = modeParam === 'tags' || q.startsWith('#');

  const term = isTagMode ? q.replace(/^#+/, '').trim() : q;
  if (term.length === 0) {
    return new Response(JSON.stringify({ items: [] }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  }

  try {
    const { index, docsById } = await getSearchIndexState();

    const results = isTagMode
      ? await index.searchAsync({ query: term, index: ['tags'], limit })
      : await index.searchAsync({ query: term, index: ['title', 'headings', 'content'], limit });

    const idsByField = (field: string): number[] => {
      const group = results.find((r) => r.field === field);
      return group ? (group.result as number[]) : [];
    };

    const mergedIds = dedupe([
      ...idsByField('title'),
      ...idsByField('headings'),
      ...idsByField('content'),
      ...idsByField('tags'),
    ]).slice(0, limit);

    const items: SearchResponseItem[] = [];
    for (const id of mergedIds) {
      const doc = docsById.get(id);
      if (!doc) continue;

      const permalink = normalizePermalink(doc.permalink);
      const snippetSource = isTagMode ? doc.title : doc.content;

      items.push({
        permalink,
        title: doc.title,
        titleHtml: buildTitleHtml(term, doc.title),
        snippetHtml: buildSnippetHtml(term, snippetSource, {
          contextWords: 30,
          contextChars: 180,
        }),
        tags: doc.tags,
        updatedTs: doc.updatedTs,
      });
    }

    return new Response(JSON.stringify({ items }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Failed to search', message }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  }
};
