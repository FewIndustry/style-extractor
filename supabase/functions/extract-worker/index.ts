/**
 * extract-worker: Server-side extraction via Browserless.
 *
 * Flow:
 * 1. Client creates a job row, calls this function with job_id + url
 * 2. This function calls Browserless to render the page, inject our DOM extraction script
 * 3. Takes a screenshot, uploads to Supabase Storage
 * 4. Runs the extraction pipeline server-side
 * 5. Stores results in the results table, updates job status
 * 6. Client receives update via Supabase Realtime
 *
 * Falls back to HTML fetch + regex extraction if Browserless is not configured.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const BROWSERLESS_API_KEY = Deno.env.get("BROWSERLESS_API_KEY") ?? "";
const BROWSERLESS_ENDPOINT = Deno.env.get("BROWSERLESS_ENDPOINT") ?? "https://chrome.browserless.io";

// --- Inline the injection script (Edge Functions can't import from packages) ---
function getInjectionScript(): string {
  return `
(function() {
  const colors = new Map();
  const fonts = new Map();
  const spacing = new Map();
  const shadows = new Set();
  const radii = new Set();
  const borderWidths = new Set();
  const classNames = new Set();

  const cssVars = {};
  try {
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule.selectorText === ':root' || rule.selectorText === ':root, :host' || rule.selectorText === 'html') {
            for (const prop of rule.style) {
              if (prop.startsWith('--')) {
                cssVars[prop] = rule.style.getPropertyValue(prop).trim();
              }
            }
          }
        }
      } catch(e) {}
    }
  } catch(e) {}

  const colorProps = ['color', 'backgroundColor', 'borderColor', 'borderTopColor',
    'borderRightColor', 'borderBottomColor', 'borderLeftColor', 'outlineColor'];
  const spacingProps = ['marginTop', 'marginRight', 'marginBottom', 'marginLeft',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'gap', 'rowGap', 'columnGap'];

  const interactiveTags = new Set(['a', 'button', 'input', 'select', 'textarea']);

  const elements = document.querySelectorAll('body *');
  elements.forEach(el => {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    const style = getComputedStyle(el);
    const tag = el.tagName.toLowerCase();
    const isInteractive = interactiveTags.has(tag) || el.getAttribute('role') === 'button';

    el.classList.forEach(c => classNames.add(c));

    colorProps.forEach(prop => {
      const val = style[prop];
      if (val && val !== 'rgba(0, 0, 0, 0)' && val !== 'transparent') {
        const key = val + '::' + prop + '::' + (isInteractive ? 'interactive' : '');
        colors.set(key, (colors.get(key) || 0) + 1);
      }
    });

    const fontKey = style.fontFamily + '::' + style.fontSize + '::' + style.fontWeight;
    const text = el.textContent || '';
    if (!fonts.has(fontKey)) {
      fonts.set(fontKey, {
        family: style.fontFamily,
        size: style.fontSize,
        weight: parseInt(style.fontWeight) || 400,
        lineHeight: style.lineHeight,
        element: tag,
        charCount: text.length
      });
    } else {
      fonts.get(fontKey).charCount += text.length;
    }

    spacingProps.forEach(prop => {
      const val = parseFloat(style[prop]);
      if (val > 0 && val < 500) {
        const key = Math.round(val);
        spacing.set(key, (spacing.get(key) || 0) + 1);
      }
    });

    if (style.boxShadow && style.boxShadow !== 'none') shadows.add(style.boxShadow);
    if (style.borderRadius && style.borderRadius !== '0px') radii.add(style.borderRadius);
    const bw = style.borderWidth;
    if (bw && bw !== '0px') borderWidths.add(bw);
  });

  const colorEntries = [];
  colors.forEach((count, key) => {
    const parts = key.split('::');
    colorEntries.push({
      value: parts[0],
      property: parts[1],
      selector: parts[2] || '',
      count
    });
  });

  return {
    colors: colorEntries.sort((a, b) => b.count - a.count),
    fonts: Array.from(fonts.values()).sort((a, b) => b.charCount - a.charCount),
    spacing: Array.from(spacing.entries()).map(([value, count]) => ({ value, property: 'mixed', count })).sort((a, b) => b.count - a.count),
    cssVars,
    shadows: Array.from(shadows),
    borderRadii: Array.from(radii),
    borderWidths: Array.from(borderWidths),
    classNames: Array.from(classNames),
    url: window.location.href
  };
})()
  `.trim();
}

async function extractViaBrowserless(url: string): Promise<{
  data: Record<string, unknown>;
  screenshot: ArrayBuffer | null;
}> {
  // Use Browserless /function to inject script and extract data
  const scriptCode = getInjectionScript();
  const functionBody = `
    module.exports = async ({ page }) => {
      await page.goto(${JSON.stringify(url)}, { waitUntil: 'networkidle0', timeout: 30000 });
      const data = await page.evaluate(() => {
        ${scriptCode}
      });
      return { data, type: 'application/json' };
    };
  `;

  const functionRes = await fetch(
    `${BROWSERLESS_ENDPOINT}/function?token=${BROWSERLESS_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: functionBody }),
    }
  );

  if (!functionRes.ok) {
    const errText = await functionRes.text().catch(() => "");
    throw new Error(`Browserless function failed: ${functionRes.status} ${errText}`);
  }

  const data = await functionRes.json();

  // Take screenshot
  let screenshot: ArrayBuffer | null = null;
  try {
    const screenshotRes = await fetch(
      `${BROWSERLESS_ENDPOINT}/screenshot?token=${BROWSERLESS_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          options: { fullPage: false, type: "png" },
          gotoOptions: { waitUntil: "networkidle0", timeout: 30000 },
        }),
      }
    );
    if (screenshotRes.ok) {
      screenshot = await screenshotRes.arrayBuffer();
    }
  } catch {
    // Screenshot is optional, continue without it
  }

  return { data, screenshot };
}

async function extractViaFetch(url: string): Promise<Record<string, unknown>> {
  // Fallback: fetch HTML + CSS and return raw text for client-side parsing
  const pageRes = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; StyleExtractor/1.0)",
      Accept: "text/html,*/*",
    },
    redirect: "follow",
  });
  if (!pageRes.ok) throw new Error(`Failed to fetch: ${pageRes.status}`);

  const html = await pageRes.text();
  const parsed = new URL(url);

  // Fetch stylesheets
  const linkRegex = /<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
  const hrefRegex = /href=["']([^"']+)["']/i;
  const cssUrls: string[] = [];
  let m;
  while ((m = linkRegex.exec(html)) !== null) {
    const hm = m[0].match(hrefRegex);
    if (hm) {
      let href = hm[1];
      if (href.startsWith("//")) href = parsed.protocol + href;
      else if (href.startsWith("/")) href = parsed.origin + href;
      else if (!href.startsWith("http")) href = new URL(href, url).href;
      cssUrls.push(href);
    }
  }

  const cssTexts: string[] = [];
  const fetches = cssUrls.slice(0, 10).map(async (cssUrl) => {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 5000);
      const r = await fetch(cssUrl, { signal: controller.signal });
      clearTimeout(t);
      if (r.ok) return (await r.text()).slice(0, 512_000);
    } catch { /* skip */ }
    return "";
  });
  cssTexts.push(...(await Promise.all(fetches)).filter(Boolean));

  // Inline styles
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let sm;
  while ((sm = styleRegex.exec(html)) !== null) cssTexts.push(sm[1]);

  return { html: html.slice(0, 2_000_000), css: cssTexts.join("\n\n"), fallback: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { job_id, url } = await req.json();

    if (!job_id || !url) {
      return new Response(
        JSON.stringify({ error: "job_id and url are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update job to processing
    await supabase
      .from("jobs")
      .update({ status: "processing" })
      .eq("id", job_id);

    try {
      let extractionData: Record<string, unknown>;
      let screenshotPath: string | null = null;

      if (BROWSERLESS_API_KEY) {
        // --- Browserless path: full DOM extraction ---
        const { data, screenshot } = await extractViaBrowserless(url);
        extractionData = data;

        // Upload screenshot if we got one
        if (screenshot && screenshot.byteLength > 0) {
          const fileName = `${job_id}.png`;
          const { error: uploadErr } = await supabase.storage
            .from("screenshots")
            .upload(fileName, screenshot, {
              contentType: "image/png",
              upsert: true,
            });
          if (!uploadErr) {
            screenshotPath = fileName;
          }
        }
      } else {
        // --- Fallback: HTML fetch (no Browserless configured) ---
        extractionData = await extractViaFetch(url);
      }

      // Store the raw extraction data as the result
      // The pipeline runs client-side for the fallback path,
      // or we store the DOM-extracted data for the Browserless path
      const metadata = {
        hasBrowserless: !!BROWSERLESS_API_KEY,
        fallback: !BROWSERLESS_API_KEY,
        extractedAt: new Date().toISOString(),
      };

      await supabase.from("results").insert({
        job_id,
        tokens: extractionData,
        metadata,
        screenshot_path: screenshotPath,
      });

      await supabase
        .from("jobs")
        .update({ status: "complete", completed_at: new Date().toISOString() })
        .eq("id", job_id);

      return new Response(
        JSON.stringify({ ok: true, job_id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err) {
      // Mark job as failed
      await supabase
        .from("jobs")
        .update({
          status: "failed",
          error_message: err instanceof Error ? err.message : "Extraction failed",
        })
        .eq("id", job_id);

      return new Response(
        JSON.stringify({ error: err instanceof Error ? err.message : "Extraction failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
