// Pure title resolution: strip frontmatter, pick first line, or use frontmatter node_title.

export function stripFrontmatter(content: string): string {
  if (!content.startsWith("---")) return content;
  const end = content.indexOf("\n---", 3);
  if (end === -1) return content;
  return content.slice(end + 4).replace(/^\n+/, "");
}

export function firstNonEmptyLine(body: string): string | null {
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (line.length === 0) continue;
    return line.replace(/^#+\s*/, "");
  }
  return null;
}

export interface ResolveTitleInput {
  basename: string;
  frontmatter: Record<string, unknown>;
  body: string;
}

export function resolveTitle(input: ResolveTitleInput): string {
  const fm = input.frontmatter?.node_title;
  if (fm !== undefined && fm !== null && String(fm).trim().length > 0) {
    return String(fm);
  }
  const first = firstNonEmptyLine(input.body);
  if (first) return first;
  return input.basename;
}
