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

async function hashUrl(url: string): Promise<string> {
  const data = new TextEncoder().encode(url.toLowerCase().replace(/\/+$/, ""));
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, skipCache } = await req.json();

    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "url is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate URL
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Block private IPs / SSRF
    const hostname = parsed.hostname;
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("169.254.") ||
      hostname.startsWith("172.16.") ||
      hostname === "0.0.0.0" ||
      hostname === "::1"
    ) {
      return new Response(JSON.stringify({ error: "Private URLs not allowed" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Enforce http/https only
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return new Response(JSON.stringify({ error: "Only http/https URLs are allowed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Cache check ---
    if (!skipCache) {
      const urlHash = await hashUrl(url);
      const { data: cached } = await supabase
        .from("extraction_cache")
        .select("tokens, extracted_at")
        .eq("url_hash", urlHash)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (cached) {
        return new Response(
          JSON.stringify({
            cached: true,
            tokens: cached.tokens,
            extracted_at: cached.extracted_at,
            url,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Fetch the page
    const pageRes = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; StyleExtractor/1.0)",
        "Accept": "text/html,application/xhtml+xml,*/*",
      },
      redirect: "follow",
    });

    if (!pageRes.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch URL: ${pageRes.status}` }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const html = await pageRes.text();

    // Extract linked stylesheet URLs from <link> tags
    const linkRegex = /<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
    const hrefRegex = /href=["']([^"']+)["']/i;
    const stylesheetUrls: string[] = [];
    let linkMatch;
    while ((linkMatch = linkRegex.exec(html)) !== null) {
      const hrefMatch = linkMatch[0].match(hrefRegex);
      if (hrefMatch) {
        let href = hrefMatch[1];
        if (href.startsWith("//")) href = parsed.protocol + href;
        else if (href.startsWith("/")) href = parsed.origin + href;
        else if (!href.startsWith("http")) href = new URL(href, url).href;
        stylesheetUrls.push(href);
      }
    }

    // Also grab <link> with href before rel (different attribute order)
    const linkRegex2 = /<link[^>]+href=["']([^"']+)["'][^>]*rel=["']stylesheet["'][^>]*>/gi;
    while ((linkMatch = linkRegex2.exec(html)) !== null) {
      let href = linkMatch[1];
      if (href.startsWith("//")) href = parsed.protocol + href;
      else if (href.startsWith("/")) href = parsed.origin + href;
      else if (!href.startsWith("http")) href = new URL(href, url).href;
      if (!stylesheetUrls.includes(href)) stylesheetUrls.push(href);
    }

    // Fetch external stylesheets (up to 10, with timeout + size limit)
    const cssContents: string[] = [];
    const fetchPromises = stylesheetUrls.slice(0, 10).map(async (cssUrl) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const cssRes = await fetch(cssUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; StyleExtractor/1.0)" },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (cssRes.ok) {
          const text = await cssRes.text();
          // Cap at 500KB per stylesheet
          return text.slice(0, 512_000);
        }
      } catch {
        // Skip failed stylesheet fetches
      }
      return "";
    });

    const results = await Promise.all(fetchPromises);
    cssContents.push(...results.filter(Boolean));

    // Extract inline <style> blocks
    const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    let styleMatch;
    while ((styleMatch = styleRegex.exec(html)) !== null) {
      cssContents.push(styleMatch[1]);
    }

    return new Response(
      JSON.stringify({
        html: html.slice(0, 2_000_000), // cap at 2MB
        css: cssContents.join("\n\n"),
        url: pageRes.url,
        stylesheetCount: cssContents.length,
        cached: false,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
