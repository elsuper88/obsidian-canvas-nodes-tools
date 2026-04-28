// Filename helpers: sanitize and uniqueness against a taken-set.

const FORBIDDEN_RE = /[\/\\:*?"<>|]/g;

export function sanitizeFilename(input: string): string {
  const cleaned = input
    .replace(/^#+\s*/, "")
    .replace(FORBIDDEN_RE, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > 0 ? cleaned : "untitled";
}

export function uniqueFilename(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base} ${i}`)) i++;
  return `${base} ${i}`;
}
