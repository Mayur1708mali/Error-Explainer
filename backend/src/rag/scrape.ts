/**
 * Scrape the curated doc sources into clean markdown.
 *
 * For each source we fetch the HTML, extract the main content, strip
 * boilerplate (nav/scripts/etc.), convert to markdown, and write one JSON
 * file per source into DOCS_DIR.
 *
 * Run with: `npx tsx backend/src/rag/scrape.ts`
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import * as cheerio from 'cheerio'
import TurndownService from 'turndown'
import { DOC_SOURCES } from './sources'
import type { DocSource } from './sources'
import { DOCS_DIR } from './paths'

export interface ScrapedDoc extends DocSource {
  markdown: string
}

// Content selectors to try, in order. First one with substantial text wins.
const CONTENT_SELECTORS = [
  'main#content',
  'article.main-page-content',
  'main',
  'div[role="main"]',
  'div.body',
  'article',
]

// Elements that are never useful as documentation content.
const STRIP_SELECTORS = [
  'script',
  'style',
  'nav',
  'header',
  'footer',
  'aside',
  'noscript',
  'iframe',
  '.breadcrumbs',
  '.sidebar',
  '.metadata',
  '.headerlink',
]

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
})

function slugify(url: string): string {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
}

function extractMainHtml(html: string): string {
  const $ = cheerio.load(html)
  $(STRIP_SELECTORS.join(',')).remove()

  for (const selector of CONTENT_SELECTORS) {
    const el = $(selector).first()
    if (el.length && el.text().trim().length > 500) {
      return el.html() ?? ''
    }
  }
  return $('body').html() ?? ''
}

async function scrapeOne(source: DocSource): Promise<ScrapedDoc> {
  const res = await fetch(source.url, {
    headers: { 'User-Agent': 'error-bot-docs-scraper/1.0' },
  })
  if (!res.ok) {
    throw new Error(`Failed to fetch ${source.url} (${res.status})`)
  }
  const html = await res.text()
  const mainHtml = extractMainHtml(html)
  const markdown = turndown.turndown(mainHtml).trim()
  return { ...source, markdown }
}

async function main() {
  await mkdir(DOCS_DIR, { recursive: true })
  console.info(`Scraping ${DOC_SOURCES.length} sources into ${DOCS_DIR}…`)

  let ok = 0
  for (const source of DOC_SOURCES) {
    try {
      const doc = await scrapeOne(source)
      const file = join(DOCS_DIR, `${slugify(source.url)}.json`)
      await writeFile(file, JSON.stringify(doc, null, 2), 'utf8')
      console.info(`  ✓ ${source.title} (${doc.markdown.length} chars)`)
      ok++
    } catch (err) {
      console.error(`  ✗ ${source.url}:`, err instanceof Error ? err.message : err)
    }
  }
  console.info(`Done. Scraped ${ok}/${DOC_SOURCES.length} sources.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
