const DEFAULT_CONTEXT_WORDS = 30;

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function tokenizeTerm(term: string): string[] {
  const tokens = term
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  if (tokens.length > 1) {
    for (let i = 1; i < tokens.length; i++) {
      tokens.push(tokens.slice(0, i + 1).join(" "));
    }
  }

  return Array.from(new Set(tokens)).sort((a, b) => b.length - a.length);
}

function highlightEscapedText(escapedText: string, rawTerm: string): string {
  const terms = tokenizeTerm(rawTerm);
  let out = escapedText;

  for (const term of terms) {
    if (!term) continue;
    const safe = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(safe, "gi");
    out = out.replace(re, '<span class="search-highlight">$&</span>');
  }

  return out;
}

function looksLikeCjk(text: string): boolean {
  return /[\u4E00-\u9FFF\u3400-\u4DBF]/.test(text);
}

export function buildSnippetHtml(
  searchTerm: string,
  text: string,
  opts?: {
    contextWords?: number;
    contextChars?: number;
    trim?: boolean;
  },
): string {
  const contextWords = opts?.contextWords ?? DEFAULT_CONTEXT_WORDS;
  const contextChars = opts?.contextChars ?? 160;

  if (!searchTerm.trim()) {
    return escapeHtml(text.slice(0, contextChars));
  }

  const isCjk = looksLikeCjk(searchTerm) || looksLikeCjk(text);

  if (isCjk) {
    const idx = text.toLowerCase().indexOf(searchTerm.trim().toLowerCase());
    const start = Math.max(0, idx === -1 ? 0 : idx - Math.floor(contextChars / 2));
    const end = Math.min(text.length, start + contextChars);
    const slice = text.slice(start, end);
    const escaped = escapeHtml(slice);
    const highlighted = highlightEscapedText(escaped, searchTerm);
    const prefix = start === 0 ? "" : "...";
    const suffix = end === text.length ? "" : "...";
    return `${prefix}${highlighted}${suffix}`;
  }

  const terms = tokenizeTerm(searchTerm);
  const tokens = text.split(/\s+/).filter(Boolean);

  const includesCheck = (tok: string) =>
    terms.some((term) => tok.toLowerCase().includes(term.toLowerCase()));

  const occurrenceFlags = tokens.map(includesCheck);

  let bestSum = 0;
  let bestIndex = 0;
  for (let i = 0; i < Math.max(tokens.length - contextWords, 0); i++) {
    const window = occurrenceFlags.slice(i, i + contextWords);
    const sum = window.reduce((acc, cur) => acc + (cur ? 1 : 0), 0);
    if (sum >= bestSum) {
      bestSum = sum;
      bestIndex = i;
    }
  }

  const startIndex = Math.max(bestIndex - contextWords, 0);
  const endIndex = Math.min(startIndex + 2 * contextWords, tokens.length);
  const sliceTokens = tokens.slice(startIndex, endIndex);

  const slice = sliceTokens.join(" ");
  const escaped = escapeHtml(slice);
  const highlighted = highlightEscapedText(escaped, searchTerm);

  const prefix = startIndex === 0 ? "" : "...";
  const suffix = endIndex === tokens.length ? "" : "...";
  return `${prefix}${highlighted}${suffix}`;
}

export function buildTitleHtml(searchTerm: string, title: string): string {
  const escaped = escapeHtml(title);
  if (!searchTerm.trim()) return escaped;
  return highlightEscapedText(escaped, searchTerm);
}
