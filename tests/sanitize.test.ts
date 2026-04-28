import { describe, it, expect } from "vitest";
import { sanitizeFilename, uniqueFilename } from "../src/sanitize";

describe("sanitizeFilename", () => {
  it("trims and collapses whitespace", () => {
    expect(sanitizeFilename("  Hello   world  ")).toBe("Hello world");
  });
  it("replaces forbidden characters with single space", () => {
    expect(sanitizeFilename(`a/b\\c:d*e?f"g<h>i|j`)).toBe("a b c d e f g h i j");
  });
  it("strips leading hashes", () => {
    expect(sanitizeFilename("### Title")).toBe("Title");
  });
  it("returns 'untitled' when result is empty", () => {
    expect(sanitizeFilename("///")).toBe("untitled");
    expect(sanitizeFilename("   ")).toBe("untitled");
  });
});

describe("uniqueFilename", () => {
  it("returns base when no taken paths", () => {
    expect(uniqueFilename("Foo", new Set())).toBe("Foo");
  });
  it("returns Foo 2 when Foo is taken", () => {
    expect(uniqueFilename("Foo", new Set(["Foo"]))).toBe("Foo 2");
  });
  it("returns Foo 3 when Foo and Foo 2 are taken", () => {
    expect(uniqueFilename("Foo", new Set(["Foo", "Foo 2"]))).toBe("Foo 3");
  });
});
