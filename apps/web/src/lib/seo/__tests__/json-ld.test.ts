import { describe, it, expect } from "vitest";
import { jsonLdHtml } from "../json-ld";

describe("jsonLdHtml", () => {
  it("escapes < and > so a </script> payload cannot break out", () => {
    const out = jsonLdHtml({ a: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
    expect(out).toContain("\\u003c");
    expect(out).toContain("\\u003e");
  });

  it("still parses back to a value deep-equal to the input", () => {
    const input = { a: "</script><script>alert(1)</script>", n: 1, nested: { b: "&" } };
    expect(JSON.parse(jsonLdHtml(input))).toEqual(input);
  });

  it("escapes the U+2028 line separator", () => {
    const out = jsonLdHtml({ a: "line break" });
    expect(out).toContain("\\u2028");
    expect(out).not.toContain(" ");
  });
});
