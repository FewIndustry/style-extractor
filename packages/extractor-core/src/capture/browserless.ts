import type { RawExtractionData } from '../types'
import { getInjectionScript } from './injection'

interface BrowserlessConfig {
  apiKey: string
  endpoint?: string
}

/**
 * Uses Browserless.io (or compatible API) to:
 * 1. Navigate to a URL
 * 2. Inject our extraction script
 * 3. Return computed style data + screenshot
 */
export async function scrapeWithBrowserless(
  url: string,
  config: BrowserlessConfig
): Promise<{ data: RawExtractionData; screenshot: Blob }> {
  const endpoint = config.endpoint || 'https://chrome.browserless.io'

  // 1. Run the extraction script via /function endpoint
  const functionRes = await fetch(`${endpoint}/function?token=${config.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: `
        module.exports = async ({ page }) => {
          await page.goto('${url}', { waitUntil: 'networkidle0', timeout: 30000 });
          const data = await page.evaluate(() => {
            ${getInjectionScript()}
          });
          return { data, type: 'application/json' };
        };
      `,
    }),
  })

  if (!functionRes.ok) {
    throw new Error(`Browserless function failed: ${functionRes.status}`)
  }

  const data: RawExtractionData = await functionRes.json()

  // 2. Take a screenshot
  const screenshotRes = await fetch(
    `${endpoint}/screenshot?token=${config.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        options: {
          fullPage: true,
          type: 'png',
        },
        gotoOptions: {
          waitUntil: 'networkidle0',
          timeout: 30000,
        },
      }),
    }
  )

  if (!screenshotRes.ok) {
    throw new Error(`Browserless screenshot failed: ${screenshotRes.status}`)
  }

  const screenshot = await screenshotRes.blob()

  return { data, screenshot }
}

/**
 * Mock scraper for local development without Browserless.
 * Uses a fetch + regex approach for basic extraction.
 */
export async function scrapeBasic(url: string): Promise<RawExtractionData> {
  const res = await fetch(url)
  const html = await res.text()

  const colorRegex = /#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)/g
  const colorMatches = html.match(colorRegex) || []

  const colors = new Map<string, number>()
  colorMatches.forEach((c) => {
    colors.set(c, (colors.get(c) || 0) + 1)
  })

  return {
    colors: Array.from(colors.entries()).map(([value, count]) => ({
      value,
      property: 'unknown',
      selector: '',
      count,
    })),
    fonts: [],
    spacing: [],
    cssVars: {},
    shadows: [],
    borderRadii: [],
    borderWidths: [],
    classNames: [],
    url,
  }
}
