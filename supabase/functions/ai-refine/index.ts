const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Simple in-memory rate limiter (per instance)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10; // requests per window (tighter limit for external API calls)
const RATE_WINDOW = 60_000; // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }

  entry.count++;
  return entry.count <= RATE_LIMIT;
}

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}, 60_000);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(clientIp)) {
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded. Try again in a minute." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const { tokens } = await req.json();

    if (!tokens || typeof tokens !== "object" || !tokens.colors) {
      return new Response(
        JSON.stringify({ error: "tokens object is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "AI refinement is not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokensJson = JSON.stringify(tokens, null, 2);

    const prompt = `You are a design-system expert. I extracted these design tokens from a website using automated heuristics. Please review and refine them.

Here are the extracted tokens:
\`\`\`json
${tokensJson}
\`\`\`

Please return a corrected JSON object with these improvements:

1. **Color role assignments**: Review the palette and reassign the primary, secondary, accent, background, and text colors if the heuristics got them wrong. Use visual design conventions:
   - "primary" should be the brand / dominant action color
   - "secondary" should be the secondary brand color
   - "accent" should be a highlight or call-to-action color
   - "background" should be the dominant page background
   - "text" should be the main body text color

2. **Semantic color names**: For each color in the \`palette\` array, add or correct the \`role\` field with a human-readable semantic name (e.g. "brand-blue", "dark-charcoal", "light-gray-bg", "link-blue", "success-green"). Names should be kebab-case.

3. **Semantic colors**: Review the \`semantic\` block (success, error, warning, info). If any are missing but a plausible candidate exists in the palette, assign it.

4. **Confidence adjustment**: Set \`metadata.confidence\` to a value between 0 and 1 reflecting how coherent and complete the token set is after your corrections.

Return ONLY valid JSON matching the same DesignTokens schema. Do not include markdown fences or explanation — just the raw JSON object.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", errText);
      return new Response(
        JSON.stringify({ error: "AI refinement failed" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    const text = result.content?.[0]?.text;

    if (!text) {
      return new Response(
        JSON.stringify({ error: "Empty AI response" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the response — strip markdown fences if present
    let cleaned = text.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
    }

    let refined;
    try {
      refined = JSON.parse(cleaned);
    } catch {
      return new Response(
        JSON.stringify({ error: "Failed to parse AI response as JSON" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!refined || !refined.colors) {
      return new Response(
        JSON.stringify({ error: "AI response missing required fields" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ tokens: refined }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
