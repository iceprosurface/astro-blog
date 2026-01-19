import FlexSearch from 'flexsearch';
import { getCollection } from 'astro:content';

export type SearchDoc = {
  id: number;
  permalink: string;
  title: string;
  tags: string[];
  headings: string[];
  content: string;
  updatedTs?: number;
};

export type SearchIndexState = {
  docsById: Map<number, SearchDoc>;
  index: FlexSearch.Document<SearchDoc>;
};

let cachedStatePromise: Promise<SearchIndexState> | null = null;

function createEncoder(): (input: string) => string[] {
  const hasSegmenter = typeof Intl !== 'undefined' && typeof (Intl as any).Segmenter === 'function';
  const segmenter = hasSegmenter
    ? new (Intl as any).Segmenter('zh', { granularity: 'word' })
    : null;

  const isUsefulToken = (token: string) => /[\p{L}\p{N}\u4E00-\u9FFF\u3400-\u4DBF]/u.test(token);

  return (input: string) => {
    const normalized = input.toLowerCase().normalize('NFKC');

    if (segmenter) {
      const out: string[] = [];
      for (const part of segmenter.segment(normalized)) {
        const token = String(part.segment).trim();
        if (!token) continue;
        if (!isUsefulToken(token)) continue;
        out.push(token);
      }

      if (out.length === 0) {
        return normalized
          .split(/\s+/)
          .map((t) => t.trim())
          .filter(Boolean);
      }

      return out;
    }

    return normalized
      .split(/([^a-z0-9]|[^\x00-\x7F])/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0 && isUsefulToken(t));
  };
}

function stripCodeBlocks(markdown: string): string {
  return markdown.replace(/```[\s\S]*?```/g, ' ');
}

function extractHeadings(markdown: string): string[] {
  const withoutCode = stripCodeBlocks(markdown);
  const lines = withoutCode.split(/\r?\n/);
  const headings: string[] = [];

  for (const line of lines) {
    const match = /^\s{0,3}(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (!match) continue;
    const headingText = match[2]
      .replace(/\s+#+\s*$/g, '')
      .trim();
    if (headingText) headings.push(headingText);
  }

  return headings;
}

function markdownToPlainText(markdown: string): string {
  let s = markdown;
  s = stripCodeBlocks(s);

  s = s.replace(/!\[([^\]]*)\]\([^\)]*\)/g, '$1');
  s = s.replace(/\[([^\]]+)\]\([^\)]*\)/g, '$1');
  s = s.replace(/`([^`]+)`/g, '$1');
  s = s.replace(/^\s{0,3}>\s?/gm, ' ');
  s = s.replace(/^\s{0,3}[-*+]\s+/gm, ' ');
  s = s.replace(/^\s{0,3}\d+\.\s+/gm, ' ');
  s = s.replace(/^\s{0,3}#{1,6}\s+/gm, ' ');
  s = s.replace(/<[^>]*>/g, ' ');
  s = s.replace(/[*_~]/g, ' ');

  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function createIndex(): FlexSearch.Document<SearchDoc> {
  const encode = createEncoder();

  return new FlexSearch.Document<SearchDoc>({
    encode,
    document: {
      id: 'id',
      tag: 'tags',
      index: [
        { field: 'title', tokenize: 'forward' },
        { field: 'headings', tokenize: 'forward' },
        { field: 'content', tokenize: 'forward' },
        { field: 'tags', tokenize: 'forward' },
      ],
    },
  });
}

async function buildDocs(): Promise<SearchDoc[]> {
  const posts = await getCollection('blog', ({ data, id }) => {
    if (id?.includes('excalidraw')) return false;
    if (data?.draft) return false;
    if (!data?.title) return false;
    if (!data?.permalink) return false;
    return true;
  });

  let nextId = 0;

  return posts.map((post) => {
    const headings = extractHeadings(post.body || '');
    const content = markdownToPlainText(post.body || '');

    const updated = post.data.updatedDate ?? post.data.updated;
    const updatedTs = updated instanceof Date ? updated.valueOf() : undefined;

    return {
      id: nextId++,
      permalink: String(post.data.permalink),
      title: String(post.data.title ?? ''),
      tags: Array.isArray(post.data.tags) ? post.data.tags.map(String) : [],
      headings,
      content,
      updatedTs,
    };
  });
}

export async function getSearchIndexState(): Promise<SearchIndexState> {
  cachedStatePromise ??= (async () => {
    const docs = await buildDocs();
    const index = createIndex();
    const docsById = new Map<number, SearchDoc>();

    const tasks: Array<Promise<unknown>> = [];
    for (const doc of docs) {
      docsById.set(doc.id, doc);
      tasks.push(index.addAsync(doc.id, doc));
    }
    await Promise.all(tasks);

    return { docsById, index };
  })();

  return cachedStatePromise;
}
