/**
 * Heuristic language/framework detector for error / stack-trace input.
 *
 * Each language has a set of weighted regex signatures. We score every
 * language against the input, then pick the winner if it clears a minimum
 * score and beats the runner-up by a margin. Otherwise detection is
 * "inconclusive" and callers can fall back to an LLM classifier.
 */

export type DetectionSource = 'heuristic' | 'llm'

export interface DetectionResult {
  language: string
  framework: string | null
  /** 0..1 — how sure we are. */
  confidence: number
  source: DetectionSource
}

interface Pattern {
  re: RegExp
  weight: number
}

interface FrameworkRule {
  name: string
  re: RegExp
}

interface LanguageRule {
  language: string
  patterns: Pattern[]
  frameworks?: FrameworkRule[]
}

// Signature weights: 3 = highly distinctive, 2 = strong, 1 = weak/shared.
const RULES: LanguageRule[] = [
  {
    language: 'Python',
    patterns: [
      { re: /Traceback \(most recent call last\):/, weight: 3 },
      { re: /^\s*File ".*", line \d+, in /m, weight: 3 },
      {
        re: /\b(?:NameError|ModuleNotFoundError|IndentationError|AttributeError|KeyError|ImportError|ZeroDivisionError|StopIteration)\b/,
        weight: 2,
      },
      { re: /\.py\b/, weight: 1 },
    ],
    frameworks: [
      { name: 'Django', re: /\bdjango(?:\.|\b)/i },
      { name: 'Flask', re: /\b(?:flask|werkzeug)\b/i },
      { name: 'FastAPI', re: /\b(?:fastapi|uvicorn|starlette)\b/i },
    ],
  },
  {
    language: 'JavaScript',
    patterns: [
      { re: /^\s*at .+ \(.*:\d+:\d+\)/m, weight: 3 },
      { re: /\bat .*node:internal/, weight: 3 },
      { re: /\b(?:ReferenceError|SyntaxError|RangeError)\b/, weight: 2 },
      { re: /TypeError: Cannot read propert(?:y|ies) of (?:undefined|null)/, weight: 3 },
      { re: /\.(?:js|jsx|mjs|cjs):\d+:\d+/, weight: 2 },
      { re: /\bnode_modules\b/, weight: 1 },
    ],
    frameworks: [
      { name: 'React', re: /\b(?:react-dom|renderWithHooks|react\b)/i },
      { name: 'Next.js', re: /\bnext\/dist\b/i },
      { name: 'Express', re: /\bexpress\/lib\b/i },
      { name: 'Node.js', re: /\bnode:internal\b/ },
    ],
  },
  {
    language: 'TypeScript',
    patterns: [
      { re: /\.tsx?:\d+:\d+/, weight: 3 },
      { re: /\bTS\d{3,5}\b/, weight: 3 },
      { re: /error TS\d+:/, weight: 3 },
    ],
    frameworks: [
      { name: 'React', re: /\b(?:react-dom|\.tsx\b)/i },
      { name: 'NestJS', re: /\b@nestjs\b/i },
    ],
  },
  {
    language: 'Java',
    patterns: [
      { re: /Exception in thread "/, weight: 3 },
      { re: /^\s*at [\w.$]+\([\w]+\.java:\d+\)/m, weight: 3 },
      { re: /\bjava\.(?:lang|util|io)\./, weight: 2 },
      { re: /Caused by: /, weight: 1 },
    ],
    frameworks: [
      { name: 'Spring', re: /\borg\.springframework\b/ },
      { name: 'Android', re: /\bandroid\./ },
      { name: 'Hibernate', re: /\borg\.hibernate\b/ },
    ],
  },
  {
    language: 'Ruby',
    patterns: [
      { re: /\.rb:\d+:in [`']/, weight: 3 },
      { re: /\((?:NoMethodError|NameError|ArgumentError|RuntimeError|LoadError)\)/, weight: 3 },
      { re: /\bfrom .*\.rb:\d+/, weight: 2 },
    ],
    frameworks: [
      { name: 'Ruby on Rails', re: /\b(?:activerecord|actionpack|railties|activesupport)\b/i },
      { name: 'Sinatra', re: /\bsinatra\b/i },
    ],
  },
  {
    language: 'Go',
    patterns: [
      { re: /goroutine \d+ \[[^\]]+\]:/, weight: 3 },
      { re: /^panic: /m, weight: 3 },
      { re: /\.go:\d+ \+0x[0-9a-f]+/, weight: 3 },
      { re: /\bruntime\.\w+\(/, weight: 1 },
    ],
    frameworks: [
      { name: 'Gin', re: /\bgin-gonic\b/i },
      { name: 'Echo', re: /\blabstack\/echo\b/i },
    ],
  },
  {
    language: 'C#',
    patterns: [
      { re: /System\.\w+Exception\b/, weight: 3 },
      { re: /^\s*at [\w.<>]+\(.*\) in .*\.cs:line \d+/m, weight: 3 },
      { re: /Unhandled exception\./, weight: 2 },
      { re: /\.cs:line \d+/, weight: 2 },
    ],
    frameworks: [
      { name: 'ASP.NET', re: /\bMicrosoft\.AspNetCore\b/ },
      { name: 'Entity Framework', re: /\bMicrosoft\.EntityFrameworkCore\b/ },
    ],
  },
  {
    language: 'PHP',
    patterns: [
      { re: /PHP (?:Fatal error|Warning|Parse error|Notice):/, weight: 3 },
      { re: /Stack trace:\n#0 /, weight: 3 },
      { re: /#\d+ .*\.php\(\d+\):/, weight: 3 },
      { re: /\bthrown in .*\.php on line \d+/, weight: 2 },
    ],
    frameworks: [
      { name: 'Laravel', re: /\bIlluminate\\/ },
      { name: 'Symfony', re: /\bSymfony\\/ },
    ],
  },
  {
    language: 'Rust',
    patterns: [
      { re: /thread '[^']+' panicked at/, weight: 3 },
      { re: /note: run with `RUST_BACKTRACE=1`/, weight: 3 },
      { re: /\.rs:\d+:\d+/, weight: 2 },
    ],
    frameworks: [
      { name: 'Actix', re: /\bactix_web\b/i },
      { name: 'Tokio', re: /\btokio\b/i },
    ],
  },
]

const MIN_SCORE = 3
const MIN_MARGIN = 1

function detectFramework(rule: LanguageRule, input: string): string | null {
  for (const fw of rule.frameworks ?? []) {
    if (fw.re.test(input)) return fw.name
  }
  return null
}

function scoreFor(rule: LanguageRule, input: string): number {
  let score = 0
  for (const p of rule.patterns) {
    if (p.re.test(input)) score += p.weight
  }
  return score
}

/**
 * Run the heuristic detector. Returns a confident result, or null when the
 * input is too ambiguous to classify by rules alone.
 */
export function detectLanguage(input: string): DetectionResult | null {
  if (!input || input.trim().length === 0) return null

  const scored = RULES.map((rule) => ({ rule, score: scoreFor(rule, input) })).sort(
    (a, b) => b.score - a.score,
  )

  const top = scored[0]
  const second = scored[1]

  if (!top || top.score < MIN_SCORE) return null
  if (second && top.score - second.score < MIN_MARGIN) return null

  // Map raw score to a confidence in [0.6, 0.95].
  const confidence = Math.min(0.95, 0.6 + 0.05 * (top.score - MIN_SCORE))

  return {
    language: top.rule.language,
    framework: detectFramework(top.rule, input),
    confidence: Number(confidence.toFixed(2)),
    source: 'heuristic',
  }
}
