/**
 * Serialize a value to a JSON-LD string that is safe to embed inside a
 * <script type="application/ld+json"> via dangerouslySetInnerHTML.
 *
 * JSON.stringify does not escape `<`, `>`, `&`, or the U+2028/U+2029 line
 * separators, so raw or model-generated values could break out of the
 * <script> element (e.g. a `</script>` inside an LLM-written forecast) and
 * execute as markup. Escaping them to their \uXXXX forms keeps the JSON
 * valid while making `</script>` / HTML-comment breakout impossible.
 */
export function jsonLdHtml(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
