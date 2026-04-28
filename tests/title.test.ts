import { describe, it, expect } from "vitest";
import {
  stripFrontmatter,
  firstNonEmptyLine,
  resolveTitle,
} from "../src/title";

describe("stripFrontmatter", () => {
  it("removes leading frontmatter", () => {
    const input = `---\nfoo: bar\n---\n\n# Title\nbody`;
    expect(stripFrontmatter(input)).toBe(`# Title\nbody`);
  });

  it("returns input unchanged when no frontmatter", () => {
    expect(stripFrontmatter(`# Just text`)).toBe(`# Just text`);
  });

  it("handles empty frontmatter", () => {
    expect(stripFrontmatter(`---\n---\nbody`)).toBe(`body`);
  });
});

describe("firstNonEmptyLine", () => {
  it("returns first non-blank trimmed line", () => {
    expect(firstNonEmptyLine(`\n  \n  hello \nworld`)).toBe("hello");
  });

  it("strips leading heading hashes", () => {
    expect(firstNonEmptyLine(`# My title\nbody`)).toBe("My title");
    expect(firstNonEmptyLine(`### Sub\nbody`)).toBe("Sub");
  });

  it("returns null when text is all whitespace", () => {
    expect(firstNonEmptyLine(`   \n\n  `)).toBe(null);
  });
});

describe("resolveTitle", () => {
  it("uses node_title from frontmatter when present", () => {
    const r = resolveTitle({
      basename: "fallback",
      frontmatter: { node_title: "From FM" },
      body: "# Heading\ntext",
    });
    expect(r).toBe("From FM");
  });

  it("falls back to first body line when no node_title", () => {
    const r = resolveTitle({
      basename: "fallback",
      frontmatter: {},
      body: "# My heading\ntext",
    });
    expect(r).toBe("My heading");
  });

  it("falls back to basename when body is empty", () => {
    const r = resolveTitle({
      basename: "Fallback",
      frontmatter: {},
      body: "",
    });
    expect(r).toBe("Fallback");
  });

  it("coerces non-string node_title to string", () => {
    const r = resolveTitle({
      basename: "fallback",
      frontmatter: { node_title: 42 },
      body: "x",
    });
    expect(r).toBe("42");
  });
});
