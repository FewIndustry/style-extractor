import type { DesignTokens } from '../types'

/**
 * Build a prompt that asks Claude to review and refine extracted design tokens.
 * The prompt instructs Claude to:
 *  - Correct color role assignments (primary, secondary, accent, background, text)
 *  - Assign semantic names to palette entries
 *  - Adjust confidence scores based on coherence
 */
export function buildRefinePrompt(tokens: DesignTokens): string {
  const tokensJson = JSON.stringify(tokens, null, 2)

  return `You are a design-system expert. I extracted these design tokens from a website using automated heuristics. Please review and refine them.

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

3. **Semantic colors**: Review the \`semantic\` block (success, error, warning, info). If any of these are missing but a plausible candidate exists in the palette, assign it.

4. **Confidence adjustment**: Set \`metadata.confidence\` to a value between 0 and 1 reflecting how coherent and complete the token set is after your corrections.

Return ONLY valid JSON matching the same DesignTokens schema. Do not include markdown fences or explanation — just the raw JSON object.`
}

/**
 * Parse Claude's JSON response into a partial DesignTokens object.
 * Returns null if parsing fails.
 */
export function parseRefineResponse(response: string): Partial<DesignTokens> | null {
  try {
    // Strip markdown code fences if Claude included them despite instructions
    let cleaned = response.trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
    }

    const parsed = JSON.parse(cleaned)

    // Basic structural validation — must have at least a colors object
    if (!parsed || typeof parsed !== 'object') return null
    if (!parsed.colors || typeof parsed.colors !== 'object') return null

    return parsed as Partial<DesignTokens>
  } catch {
    return null
  }
}
