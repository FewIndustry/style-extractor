# StyleExtractor — Development Documentation

## Overview

StyleExtractor is a web app that extracts design tokens (colors, typography, spacing, shadows) from websites and PDFs, then exports them as CSS variables, Tailwind config, W3C Design Tokens JSON, or SCSS.

**Stack:** Vite + React 19 + TypeScript + Tailwind CSS v4 (frontend) · Supabase Edge Functions + Postgres + Auth (backend)

---

## Project Structure

```
style-extractor/
├── src/                          # React frontend (Vite)
│   ├── main.tsx                  # Entry point
│   ├── App.tsx                   # Router setup (/, /history)
│   ├── index.css                 # Tailwind imports + theme tokens
│   ├── routes/
│   │   ├── Home.tsx              # Main page: input → loading → tabbed results
│   │   └── History.tsx           # Past extractions list (auth required)
│   ├── components/
│   │   ├── auth/
│   │   │   ├── AuthModal.tsx     # Sign in/up modal (email + OAuth)
│   │   │   └── UserMenu.tsx      # Avatar dropdown (history, sign out)
│   │   ├── input/
│   │   │   ├── UrlInput.tsx      # URL text field + submit
│   │   │   └── PdfUpload.tsx     # Drag-and-drop PDF upload
│   │   ├── results/
│   │   │   ├── ColorPalette.tsx  # Color swatches with click-to-copy
│   │   │   ├── TypographyPreview.tsx
│   │   │   ├── SpacingScale.tsx
│   │   │   └── ShadowsAndRadii.tsx
│   │   ├── export/
│   │   │   └── ExportPanel.tsx   # Format tabs + code preview + download
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       ├── CopyButton.tsx
│   │       └── Loading.tsx
│   ├── hooks/
│   │   ├── useExtraction.ts      # Core hook: extract, refine, cache, reset
│   │   ├── useAuth.ts            # Supabase Auth wrapper
│   │   └── useRealtimeJob.ts     # Supabase Realtime subscription (Browserless path)
│   ├── lib/
│   │   ├── supabase.ts           # Supabase client init
│   │   ├── pdf-extractor.ts      # Client-side PDF parsing (lazy-loaded)
│   │   └── export/
│   │       ├── index.ts          # exportTokens(), getFileName()
│   │       ├── css-vars.ts       # → :root { --color-primary: ... }
│   │       ├── tailwind-config.ts # → Tailwind theme config
│   │       ├── design-tokens.ts  # → W3C Design Tokens JSON
│   │       └── scss.ts           # → $color-primary: ...
│   └── types/
│       └── tokens.ts             # Re-exports shared types + frontend-only types
│
├── packages/
│   └── extractor-core/           # Shared extraction engine (pure TS, no React)
│       └── src/
│           ├── index.ts          # Barrel exports
│           ├── types.ts          # Canonical shared types (Raw*, ColorToken, DesignTokens, etc.)
│           ├── pipeline.ts       # Orchestrator: Layer 0→2 cascade
│           ├── ai/
│           │   └── refine.ts     # AI prompt builder + response parser
│           ├── capture/
│           │   ├── injection.ts  # DOM walker script for Browserless
│           │   └── browserless.ts # Browserless.io API client
│           ├── detect/
│           │   ├── css-vars.ts   # Layer 0: CSS custom property extraction
│           │   ├── framework.ts  # Layer 1: Tailwind/Bootstrap/MUI/etc detection
│           │   └── heuristics.ts # Layer 2: Color role assignment
│           ├── normalize/
│           │   ├── colors.ts     # CIELAB clustering, neutral detection
│           │   ├── typography.ts # Font dedup, role detection, scale matching
│           │   └── spacing.ts    # Grid base detection (4/5/6/8/10px)
│           └── __tests__/        # Vitest unit tests (72 tests)
│
├── supabase/
│   ├── functions/
│   │   ├── extract/index.ts      # Fetch URL server-side, grab stylesheets, check cache
│   │   ├── extract-worker/index.ts # Browserless path (headless browser extraction)
│   │   ├── cache-save/index.ts   # Upsert to extraction_cache (24h TTL)
│   │   └── ai-refine/index.ts    # Proxy to Claude API for token refinement
│   └── migrations/
│       ├── 001_create_jobs.sql
│       ├── 002_create_results.sql
│       └── 003_create_cache.sql
│
├── package.json
├── vite.config.ts                # Aliases: @/ → src/, @extractor/ → packages/extractor-core/src/
├── vitest.config.ts              # Same aliases, includes packages + src test patterns
├── tsconfig.app.json             # Path aliases, strict mode
└── .env                          # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
```

---

## Architecture

### Extraction Pipeline

The extraction follows a **layered cascade** that minimizes AI API costs:

```
Input (URL or PDF)
  │
  ├─ URL path: Supabase Edge Function fetches HTML + linked CSS server-side
  │    └─ Cache check (SHA-256 hash, 24h TTL)
  │
  ├─ PDF path: Client-side pdfjs-dist parsing (lazy-loaded, 2.1MB worker)
  │
  ▼
extractFromSource() — regex extraction with CSS property context
  │
  ▼
runPipeline(rawData) — Layer cascade:
  │
  ├─ Layer 0: CSS Custom Properties  (free — reads --var names)
  │   └─ Parses hex, rgb, hsl, oklch, bare "H S% L%" formats
  │   └─ Infers roles from var names (--color-primary → "primary")
  │
  ├─ Layer 1: Framework Detection  (free — pattern matching)
  │   └─ Tailwind, Bootstrap, MUI, Chakra, Ant Design, Bulma, shadcn
  │
  ├─ Layer 2: Heuristic Analysis  (cheap compute)
  │   ├─ CIELAB color clustering (ΔE < 5 threshold)
  │   ├─ Neutral separation (saturation + lightness rules)
  │   ├─ Color role assignment (context-aware or saturation-weighted)
  │   ├─ Font dedup, role detection (body/heading/mono), scale matching
  │   └─ Spacing grid detection (best-fit from 4/5/6/8/10px bases)
  │
  └─ Layer 3: AI Refinement  (optional — user-initiated)
      └─ Claude API via ai-refine Edge Function
      └─ Corrects roles, names colors semantically, adjusts confidence
```

### Data Flow

```
Browser                          Supabase Edge Functions
───────                          ──────────────────────
useExtraction.extractFromUrl()
  │
  ├──POST──► extract/index.ts
  │           ├─ Cache hit? → return cached tokens
  │           └─ Fetch HTML + CSS → return to client
  │
  ├─ extractFromSource() ─── client-side regex parsing
  ├─ runPipeline() ────────── client-side Layer 0→2
  │
  ├──POST──► cache-save/index.ts  (fire-and-forget)
  │
  └─ (optional) refineWithAI()
      └──POST──► ai-refine/index.ts
                  └──► Anthropic API (claude-sonnet-4-20250514)
```

### Key Design Decisions

1. **Client-side pipeline** — Extraction runs in the browser after the Edge Function fetches HTML/CSS. This keeps the serverless functions lightweight and avoids compute costs.

2. **CIELAB clustering** — Colors are grouped by perceptual distance (CIE76 ΔE) rather than raw RGB distance, producing more visually meaningful clusters.

3. **CSS property context** — When extracting colors, the CSS property (`color`, `background-color`, `border-color`) is tracked, enabling smarter role assignment in the heuristic layer.

4. **Layered cost structure** — Layers 0–2 are free/cheap. The AI layer (Layer 3) is opt-in per extraction, keeping default usage at $0.

5. **24-hour cache** — URL extractions are cached by SHA-256 hash with a 24h TTL to avoid redundant fetches.

6. **Code-split PDF** — pdfjs-dist worker (2.1MB) is lazy-loaded via `import()` only when the user uploads a PDF.

---

## Environment Variables

### Frontend (.env)

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase publishable (anon) key |

### Supabase Edge Functions (set via Supabase dashboard or CLI)

| Variable | Description | Used by |
|---|---|---|
| `SUPABASE_URL` | Auto-injected by Supabase | extract, cache-save |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected by Supabase | extract, cache-save |
| `ANTHROPIC_API_KEY` | Claude API key | ai-refine |
| `BROWSERLESS_API_KEY` | Browserless.io key (optional) | extract-worker |

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- Supabase CLI (`npm i -g supabase`)

### Install and Run

```bash
# Install dependencies
npm install

# Start Vite dev server
npm run dev

# Run tests
npm test

# Type check
npx tsc -p tsconfig.app.json --noEmit

# Build for production
npm run build
```

### Supabase Setup

```bash
# Link to your Supabase project
supabase link --project-ref <your-project-ref>

# Push database migrations
supabase db push

# Deploy Edge Functions (--no-verify-jwt required for publishable key format)
supabase functions deploy extract --no-verify-jwt
supabase functions deploy extract-worker --no-verify-jwt
supabase functions deploy cache-save --no-verify-jwt
supabase functions deploy ai-refine --no-verify-jwt

# Set secrets for AI refinement
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

### OAuth Setup (Google/GitHub)

Configure OAuth providers in the Supabase dashboard under **Authentication > Providers**. Each provider requires a Client ID and Client Secret obtained from:

- **Google:** [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → OAuth 2.0 Client
- **GitHub:** [GitHub Developer Settings](https://github.com/settings/developers) → OAuth Apps → New OAuth App

Set the callback URL to: `https://<your-project-ref>.supabase.co/auth/v1/callback`

---

## Path Aliases

Configured in both `tsconfig.app.json` and `vite.config.ts`:

| Alias | Target |
|---|---|
| `@/*` | `./src/*` |
| `@extractor/*` | `./packages/extractor-core/src/*` |

Example usage:
```ts
import type { DesignTokens } from '@/types/tokens'
import { runPipeline } from '@extractor/pipeline'
import type { RawExtractionData } from '@extractor/types'
```

---

## Shared Types

Canonical types live in `packages/extractor-core/src/types.ts`:

| Type | Purpose |
|---|---|
| `RawColorData` | Raw extracted color with CSS property context |
| `RawFontData` | Raw font entry with element, size, weight, charCount |
| `RawSpacingData` | Raw spacing value with property and count |
| `RawExtractionData` | Full raw extraction payload (input to pipeline) |
| `ColorToken` | Processed color with hex, HSL, role, frequency |
| `TypographyToken` | Processed font family with weights and role |
| `TypeScaleEntry` | Single entry in the type scale |
| `SpacingScale` | Detected spacing grid (base, unit, values, confidence) |
| `DesignTokens` | Complete extraction output (colors, typography, spacing, borders, shadows, metadata) |

Frontend-only types remain in `src/types/tokens.ts`:

| Type | Purpose |
|---|---|
| `ExtractionJob` | Supabase `jobs` table row |
| `ExtractionResult` | Supabase `results` table row |
| `ExportFormat` | `'css' \| 'tailwind' \| 'json' \| 'scss'` |

---

## Database Schema

### `jobs`
Tracks extraction requests (used with Browserless worker path).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK to auth.users |
| `source_type` | text | `'url'` or `'pdf'` |
| `source_url` | text | nullable |
| `status` | text | `pending → processing → complete/failed` |
| `error_message` | text | nullable |
| `created_at` | timestamptz | |
| `completed_at` | timestamptz | nullable |

### `results`
Stores extraction outputs linked to jobs.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `job_id` | uuid | FK to jobs |
| `tokens` | jsonb | Full DesignTokens object |
| `metadata` | jsonb | |
| `screenshot_path` | text | Supabase Storage path, nullable |
| `created_at` | timestamptz | |

### `extraction_cache`
URL-hash-based extraction cache with 24h TTL.

| Column | Type | Notes |
|---|---|---|
| `url_hash` | text | SHA-256 of normalized URL |
| `tokens` | jsonb | Cached DesignTokens |
| `extracted_at` | timestamptz | |
| `expires_at` | timestamptz | TTL check: `expires_at > now()` |

All tables have Row Level Security (RLS) enabled.

---

## Edge Functions

### `extract` — URL Extraction
- **POST** `{ url: string, skipCache?: boolean }`
- Validates URL (blocks private IPs, non-http protocols)
- Checks `extraction_cache` (unless `skipCache`)
- Fetches HTML + up to 10 linked stylesheets (5s timeout each, 500KB cap per sheet)
- Extracts inline `<style>` blocks
- Returns `{ html, css, url, stylesheetCount, cached }` or `{ cached, tokens }` for cache hits

### `extract-worker` — Browserless Extraction
- **POST** `{ job_id: string, url: string }`
- Uses Browserless.io headless browser to inject DOM walker script
- Falls back to basic fetch if Browserless unavailable
- Updates job status via Supabase (realtime)
- Stores results in `results` table

### `cache-save` — Cache Upsert
- **POST** `{ url_hash: string, tokens: DesignTokens }`
- Upserts into `extraction_cache` with 24h expiry

### `ai-refine` — AI Token Refinement
- **POST** `{ tokens: DesignTokens }`
- Sends tokens to Claude API (claude-sonnet-4-20250514) for semantic refinement
- Returns `{ tokens: DesignTokens }` with corrected roles, names, and confidence
- Requires `ANTHROPIC_API_KEY` secret

---

## Testing

72 unit tests across 7 test files using Vitest:

```bash
npm test           # Run all tests once
npm run test:watch # Watch mode
```

| Test File | Tests | Coverage |
|---|---|---|
| `pipeline.test.ts` | 9 | Full pipeline integration, layers, confidence |
| `colors.test.ts` | 15 | Clustering, tokens, neutrals, color formats |
| `typography.test.ts` | 9 | Font dedup, roles, scale, base size |
| `spacing.test.ts` | 5 | Grid detection, sorting, confidence |
| `framework.test.ts` | 8 | Tailwind, Bootstrap, MUI, edge cases |
| `css-vars.test.ts` | 10 | Hex/rgb/hsl/bare HSL, role inference |
| `exports.test.ts` | 16 | CSS vars, Tailwind config, W3C JSON, SCSS |

---

## Export Formats

| Format | File | Function | Output Example |
|---|---|---|---|
| CSS Variables | `css-vars.ts` | `generateCssVars()` | `:root { --color-primary: #3b82f6; }` |
| Tailwind Config | `tailwind-config.ts` | `generateTailwindConfig()` | `export default { theme: { extend: { ... } } }` |
| W3C Design Tokens | `design-tokens.ts` | `generateDesignTokensJson()` | `{ "color": { "primary": { "$value": "#3b82f6", "$type": "color" } } }` |
| SCSS | `scss.ts` | `generateScss()` | `$color-primary: #3b82f6;` |

---

## Hooks

### `useExtraction()`
Main extraction hook. Returns:

| Property | Type | Description |
|---|---|---|
| `status` | `'idle' \| 'processing' \| 'complete' \| 'failed'` | Current state |
| `tokens` | `DesignTokens \| null` | Extraction result |
| `error` | `string \| null` | Error message |
| `layers` | `string[]` | Which extraction layers were used |
| `cached` | `boolean` | Whether result came from cache |
| `refining` | `boolean` | Whether AI refinement is in progress |
| `extractFromUrl(url, skipCache?)` | function | Start URL extraction |
| `extractFromPdf(file)` | function | Start PDF extraction |
| `refineWithAI()` | function | Trigger AI refinement on current tokens |
| `reset()` | function | Return to idle state |

### `useAuth()`
Supabase Auth wrapper. Returns `user`, `loading`, and sign-in/sign-out methods for email, Google, and GitHub.

### `useRealtimeJob(jobId)`
Subscribes to Supabase Realtime for live job status updates (used with the Browserless worker path).

---

## Color Formats Supported

The extraction engine parses these color formats from CSS:

| Format | Example | Source |
|---|---|---|
| Hex (3/6/8 digit) | `#3b82f6`, `#fff` | Universal |
| `rgb()` / `rgba()` | `rgb(59, 130, 246)` | Universal |
| `hsl()` / `hsla()` | `hsl(217, 91%, 60%)` | Universal |
| `oklch()` | `oklch(0.7 0.15 250)` | Modern CSS (P3) |
| Bare HSL | `217 91% 60%` | shadcn/Radix CSS vars |

---

## Framework Detection

Detected via class name patterns and CSS variable prefixes:

| Framework | Class Patterns | Var Prefix |
|---|---|---|
| Tailwind | `sm:`, `bg-*-\d+`, `text-sm`, `px-\d` | `--tw-` |
| Bootstrap | `btn-*`, `col-md-*`, `navbar`, `container` | `--bs-` |
| Material UI | `Mui*`, `css-*` | `--mui-` |
| Chakra UI | `chakra-*` | `--chakra-` |
| Ant Design | `ant-*` | `--ant-` |
| Bulma | `is-primary`, `column`, `hero` | `--bulma-` |
| shadcn/ui | `inline-flex`, `destructive` | `--radius`, `--primary` |
