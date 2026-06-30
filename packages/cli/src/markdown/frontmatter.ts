/** Split markdown into [before, frontmatter, body] or null if invalid */
export function splitFrontmatter(content: string): {
  frontmatter: string;
  body: string;
} | null {
  const parts = content.split(/^---\s*$/m);
  if (parts.length < 3) {
    return null;
  }
  return {
    frontmatter: parts[1],
    body: parts.slice(2).join("---"),
  };
}

export function joinFrontmatter(frontmatter: string, body: string): string {
  const fm = frontmatter.trimEnd();
  const b = body.startsWith("\n") ? body : `\n${body}`;
  return `---\n${fm}\n---${b}`;
}

/** Set or replace a scalar frontmatter key (snake_case as written) */
export function setFrontmatterScalar(
  content: string,
  key: string,
  value: string | number,
): string {
  const split = splitFrontmatter(content);
  if (!split) {
    return content;
  }
  const line = `${key}: ${value}`;
  let fm = split.frontmatter;
  const re = new RegExp(`^${key}:\\s*.+$`, "im");
  if (re.test(fm)) {
    fm = fm.replace(re, line);
  } else {
    fm = `${fm.trimEnd()}\n${line}\n`;
  }
  return joinFrontmatter(fm, split.body);
}

export function setFrontmatterScalars(
  content: string,
  fields: Record<string, string | number>,
): string {
  let out = content;
  for (const [key, value] of Object.entries(fields)) {
    out = setFrontmatterScalar(out, key, value);
  }
  return out;
}
