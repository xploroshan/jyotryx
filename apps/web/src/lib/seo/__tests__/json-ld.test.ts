import { describe, it, expect } from "vitest";
import { jsonLdHtml, definedTermLd, howToLd, serviceLd, ORG_ID } from "../json-ld";
import { SITE_ORIGIN } from "../server-api";

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

describe("definedTermLd", () => {
  it("builds a DefinedTerm inside the shared /learn glossary set", () => {
    const out = definedTermLd({
      name: "Manglik dosha",
      description: "A condition arising from Mars placement in the birth chart.",
      url: `${SITE_ORIGIN}/learn/manglik-dosha`,
    });
    expect(out["@context"]).toBe("https://schema.org");
    expect(out["@type"]).toBe("DefinedTerm");
    expect(out.name).toBe("Manglik dosha");
    expect(out.description).toBe(
      "A condition arising from Mars placement in the birth chart.",
    );
    expect(out.url).toBe(`${SITE_ORIGIN}/learn/manglik-dosha`);
    expect(out.inDefinedTermSet["@type"]).toBe("DefinedTermSet");
    expect(out.inDefinedTermSet["@id"]).toBe(`${SITE_ORIGIN}/learn#glossary`);
    expect(out.inDefinedTermSet.name).toBe("MyAstro360 Vedic astrology glossary");
    expect(out.inDefinedTermSet.url).toBe(`${SITE_ORIGIN}/learn`);
  });
});

describe("howToLd", () => {
  it("builds a HowTo with 1-indexed step positions", () => {
    const out = howToLd({
      name: "How to check manglik status",
      url: `${SITE_ORIGIN}/learn/manglik-dosha`,
      steps: ["Enter birth details", "Review Mars placement", "Read the verdict"],
    });
    expect(out["@context"]).toBe("https://schema.org");
    expect(out["@type"]).toBe("HowTo");
    expect(out.name).toBe("How to check manglik status");
    expect(out.url).toBe(`${SITE_ORIGIN}/learn/manglik-dosha`);
    expect(out.step).toEqual([
      { "@type": "HowToStep", position: 1, text: "Enter birth details" },
      { "@type": "HowToStep", position: 2, text: "Review Mars placement" },
      { "@type": "HowToStep", position: 3, text: "Read the verdict" },
    ]);
  });

  it("omits description when not provided and includes it when given", () => {
    const without = howToLd({ name: "n", url: "u", steps: [] });
    expect("description" in without).toBe(false);
    const withDesc = howToLd({ name: "n", description: "d", url: "u", steps: [] });
    expect(withDesc.description).toBe("d");
  });
});

describe("serviceLd", () => {
  it("builds a Service provided by the canonical Organization", () => {
    const out = serviceLd({
      name: "Kundli matching",
      serviceType: "Vedic astrology compatibility analysis",
      description: "Guna milan and dosha analysis for two charts.",
      url: `${SITE_ORIGIN}/kundli-matching`,
    });
    expect(out["@context"]).toBe("https://schema.org");
    expect(out["@type"]).toBe("Service");
    expect(out.name).toBe("Kundli matching");
    expect(out.serviceType).toBe("Vedic astrology compatibility analysis");
    expect(out.description).toBe("Guna milan and dosha analysis for two charts.");
    expect(out.url).toBe(`${SITE_ORIGIN}/kundli-matching`);
    expect(out.provider["@type"]).toBe("Organization");
    expect(out.provider["@id"]).toBe(ORG_ID);
    expect(out.areaServed).toEqual(["India", "Indian diaspora worldwide"]);
  });
});
