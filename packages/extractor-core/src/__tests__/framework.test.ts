import { describe, it, expect } from 'vitest'
import { detectFramework } from '../detect/framework'

describe('detectFramework', () => {
  it('detects Tailwind from class names', () => {
    const classNames = [
      'flex', 'grid', 'block', 'inline', 'mt-4', 'mb-2', 'px-6', 'py-3',
      'bg-red-500', 'bg-blue-200', 'text-sm', 'text-lg', 'text-xl',
      'sm:flex', 'md:grid', 'lg:block',
    ]
    const result = detectFramework(classNames, {})
    expect(result).not.toBeNull()
    expect(result!.name).toBe('tailwind')
  })

  it('detects Tailwind from CSS vars', () => {
    const vars = { '--tw-ring-color': '#3b82f6', '--tw-shadow': '0 1px 3px rgba(0,0,0,0.1)' }
    const result = detectFramework([], vars)
    expect(result).not.toBeNull()
    expect(result!.name).toBe('tailwind')
  })

  it('detects Bootstrap from class names', () => {
    const classNames = [
      'btn-primary', 'btn-secondary', 'col-md-6', 'col-lg-4',
      'navbar', 'container', 'row', 'container-fluid',
    ]
    const result = detectFramework(classNames, {})
    expect(result).not.toBeNull()
    expect(result!.name).toBe('bootstrap')
  })

  it('detects Bootstrap from CSS vars', () => {
    const vars = { '--bs-primary': '#0d6efd', '--bs-secondary': '#6c757d' }
    const result = detectFramework([], vars)
    expect(result).not.toBeNull()
    expect(result!.name).toBe('bootstrap')
  })

  it('detects Material UI', () => {
    const classNames = ['MuiButton-root', 'MuiTypography-h1', 'Mui-focused', 'css-abc123']
    const result = detectFramework(classNames, {})
    expect(result).not.toBeNull()
    expect(result!.name).toBe('material-ui')
  })

  it('returns null for unrecognized classes', () => {
    const classNames = ['my-custom-class', 'another-class', 'wrapper']
    const result = detectFramework(classNames, {})
    expect(result).toBeNull()
  })

  it('returns null for empty inputs', () => {
    expect(detectFramework([], {})).toBeNull()
  })

  it('has confidence between 0 and 1', () => {
    const classNames = ['flex', 'grid', 'mt-4', 'px-6', 'bg-red-500', 'text-sm']
    const result = detectFramework(classNames, {})
    if (result) {
      expect(result.confidence).toBeGreaterThan(0)
      expect(result.confidence).toBeLessThanOrEqual(1)
    }
  })
})
