import type { AnalyzeResponse } from '../../shared/types'

/**
 * Hardcoded mock response for POST /analyze.
 * Phase 4+ will replace this with a real Ollama-backed analysis.
 */
export const mockAnalyzeResponse: AnalyzeResponse = {
  language: 'JavaScript',
  framework: 'React',
  rootCause:
    'A value expected to be an array is undefined at the point where .map() is called, so the runtime throws before rendering.',
  fixSteps: [
    'Log the variable right before the .map() call to confirm it is undefined.',
    'Provide a safe default (e.g. `const items = data ?? []`) so mapping over an empty array is a no-op.',
    'If the data is fetched asynchronously, render a loading state until it resolves.',
    'Add a type or prop-type so this class of error is caught at build time.',
  ],
  confidence: 0.82,
  sources: [
    {
      title: 'Array.prototype.map() - JavaScript | MDN',
      url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map',
      snippet:
        'The map() method creates a new array populated with the results of calling a provided function on every element in the calling array.',
    },
  ],
}
