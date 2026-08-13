/**
 * Curated documentation sources for the RAG corpus.
 *
 * We start with two stacks that cover the most common errors:
 *  - JavaScript (MDN error reference + core objects)
 *  - Python (official docs: exceptions + errors tutorial)
 *
 * `language` MUST match the detector's output (see detect.ts) so retrieval
 * can filter by detected language.
 */

export interface DocSource {
  /** Language label, must match detector output, e.g. "JavaScript", "Python". */
  language: string
  /** Optional framework label if the doc is framework-specific. */
  framework: string | null
  /** Human-readable title used in citations. */
  title: string
  /** Canonical URL used in citations and for scraping. */
  url: string
}

export const DOC_SOURCES: DocSource[] = [
  // ── JavaScript (MDN) ───────────────────────────────────────────────────────
  {
    language: 'JavaScript',
    framework: null,
    title: 'ReferenceError: "x" is not defined - MDN',
    url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Not_defined',
  },
  {
    language: 'JavaScript',
    framework: null,
    title: "TypeError: can't access property of undefined/null - MDN",
    url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Cant_access_property',
  },
  {
    language: 'JavaScript',
    framework: null,
    title: 'TypeError: "x" is not a function - MDN',
    url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Not_a_function',
  },
  {
    language: 'JavaScript',
    framework: null,
    title: 'SyntaxError: Unexpected token - MDN',
    url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Unexpected_token',
  },
  {
    language: 'JavaScript',
    framework: null,
    title: 'Array.prototype.map() - MDN',
    url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map',
  },
  {
    language: 'JavaScript',
    framework: null,
    title: 'JSON.parse() - MDN',
    url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse',
  },

  // ── Python (official docs) ─────────────────────────────────────────────────
  {
    language: 'Python',
    framework: null,
    title: 'Built-in Exceptions — Python documentation',
    url: 'https://docs.python.org/3/library/exceptions.html',
  },
  {
    language: 'Python',
    framework: null,
    title: 'Errors and Exceptions — Python documentation',
    url: 'https://docs.python.org/3/tutorial/errors.html',
  },
]
