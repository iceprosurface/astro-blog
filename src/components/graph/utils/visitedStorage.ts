function normalizePermalink(permalink: string): string {
    const trimmed = permalink.trim();
    if (trimmed === "" || trimmed === "/") return "/";
    const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    return withLeadingSlash.endsWith("/") ? withLeadingSlash.slice(0, -1) : withLeadingSlash;
}

export function getVisited(): Set<string> {
    try {
        const raw = JSON.parse(localStorage.getItem("graph-visited") || "[]");
        if (!Array.isArray(raw)) return new Set();
        return new Set(raw.map((p) => normalizePermalink(String(p))));
    } catch {
        return new Set();
    }
}

export function addToVisited(permalink: string) {
    const visited = getVisited();
    visited.add(normalizePermalink(permalink));
    localStorage.setItem("graph-visited", JSON.stringify([...visited]));
}
