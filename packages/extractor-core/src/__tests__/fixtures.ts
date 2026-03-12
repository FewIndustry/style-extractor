import type { RawExtractionData } from '../types'

export const sampleRawData: RawExtractionData = {
  colors: [
    { value: '#3b82f6', property: 'backgroundColor', selector: '.btn-primary', count: 12 },
    { value: '#1e40af', property: 'backgroundColor', selector: '.btn-primary:hover', count: 4 },
    { value: '#3b83f6', property: 'color', selector: 'a', count: 8 }, // near-duplicate of primary
    { value: '#ef4444', property: 'color', selector: '.error', count: 3 },
    { value: '#22c55e', property: 'color', selector: '.success', count: 3 },
    { value: '#f59e0b', property: 'color', selector: '.warning', count: 2 },
    { value: '#ffffff', property: 'backgroundColor', selector: 'body', count: 20 },
    { value: '#111827', property: 'color', selector: 'body', count: 15 },
    { value: '#6b7280', property: 'color', selector: '.text-muted', count: 7 },
    { value: '#f3f4f6', property: 'backgroundColor', selector: '.card', count: 5 },
    { value: '#e5e7eb', property: 'borderColor', selector: '.border', count: 6 },
    { value: '#9333ea', property: 'backgroundColor', selector: '.badge', count: 2 },
  ],
  fonts: [
    { family: 'Inter', size: '16px', weight: 400, lineHeight: '1.5', element: 'p', charCount: 500 },
    { family: 'Inter', size: '14px', weight: 400, lineHeight: '1.4', element: 'span', charCount: 200 },
    { family: 'Inter', size: '24px', weight: 700, lineHeight: '1.2', element: 'h2', charCount: 50 },
    { family: 'Inter', size: '32px', weight: 700, lineHeight: '1.1', element: 'h1', charCount: 20 },
    { family: 'JetBrains Mono', size: '14px', weight: 400, lineHeight: '1.6', element: 'code', charCount: 30 },
  ],
  spacing: [
    { value: 4, property: 'padding', count: 15 },
    { value: 8, property: 'padding', count: 25 },
    { value: 12, property: 'margin', count: 10 },
    { value: 16, property: 'padding', count: 30 },
    { value: 24, property: 'margin', count: 18 },
    { value: 32, property: 'padding', count: 12 },
    { value: 48, property: 'margin', count: 6 },
    { value: 64, property: 'padding', count: 4 },
  ],
  cssVars: {
    '--color-primary': '#3b82f6',
    '--color-secondary': '#9333ea',
    '--color-accent': '#f59e0b',
    '--color-background': '#ffffff',
    '--color-text': '#111827',
    '--color-success': '#22c55e',
    '--color-error': '#ef4444',
    '--color-warning': '#f59e0b',
    '--font-sans': 'Inter, system-ui, sans-serif',
    '--font-mono': 'JetBrains Mono, monospace',
    '--radius': '0.5rem',
    '--spacing-1': '4px',
    '--spacing-2': '8px',
  },
  shadows: [
    '0 1px 3px rgba(0,0,0,0.1)',
    '0 4px 6px rgba(0,0,0,0.1)',
    '0 10px 15px rgba(0,0,0,0.1)',
  ],
  borderRadii: ['4px', '8px', '12px', '9999px'],
  borderWidths: ['1px', '2px'],
  classNames: [
    'flex', 'items-center', 'bg-blue-500', 'text-sm', 'px-4', 'py-2',
    'rounded-lg', 'mt-4', 'grid', 'col-span-2',
  ],
  url: 'https://example.com',
}

export const tailwindClassNames = [
  'flex', 'grid', 'block', 'inline', 'mt-4', 'mb-2', 'px-6', 'py-3',
  'bg-red-500', 'bg-blue-200', 'text-sm', 'text-lg', 'text-xl',
  'sm:flex', 'md:grid', 'lg:block',
]

export const bootstrapClassNames = [
  'btn-primary', 'btn-secondary', 'col-md-6', 'col-lg-4',
  'navbar', 'container', 'row', 'container-fluid',
]

export const muiClassNames = [
  'MuiButton-root', 'MuiTypography-h1', 'Mui-focused', 'css-abc123',
]
