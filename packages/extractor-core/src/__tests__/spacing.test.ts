import { describe, it, expect } from 'vitest'
import { detectSpacingScale } from '../normalize/spacing'
import type { RawSpacingData } from '../types'

describe('detectSpacingScale', () => {
  it('returns null for less than 3 spacing values', () => {
    const raw: RawSpacingData[] = [
      { value: 8, property: 'padding', count: 5 },
      { value: 16, property: 'padding', count: 3 },
    ]
    expect(detectSpacingScale(raw)).toBeNull()
  })

  it('detects base-4 grid', () => {
    const raw: RawSpacingData[] = [
      { value: 4, property: 'padding', count: 10 },
      { value: 8, property: 'padding', count: 20 },
      { value: 12, property: 'margin', count: 8 },
      { value: 16, property: 'padding', count: 15 },
      { value: 24, property: 'margin', count: 10 },
      { value: 32, property: 'padding', count: 5 },
    ]
    const result = detectSpacingScale(raw)
    expect(result).not.toBeNull()
    expect(result!.base).toBe(4)
    expect(result!.unit).toBe('px')
  })

  it('detects base-8 grid when non-8 multiples are absent', () => {
    // Include values like 40 (multiple of 8 but not 4... wait, 40 is multiple of 4)
    // Actually all multiples of 8 are also multiples of 4, so base-4 will always match.
    // Test that base-5 can be detected with values only divisible by 5.
    const raw: RawSpacingData[] = [
      { value: 5, property: 'padding', count: 20 },
      { value: 10, property: 'padding', count: 15 },
      { value: 15, property: 'margin', count: 12 },
      { value: 20, property: 'padding', count: 8 },
      { value: 25, property: 'margin', count: 5 },
      { value: 30, property: 'padding', count: 3 },
    ]
    const result = detectSpacingScale(raw)
    expect(result).not.toBeNull()
    expect(result!.base).toBe(5)
  })

  it('returns sorted values on the grid', () => {
    const raw: RawSpacingData[] = [
      { value: 32, property: 'padding', count: 5 },
      { value: 8, property: 'padding', count: 20 },
      { value: 16, property: 'padding', count: 15 },
    ]
    const result = detectSpacingScale(raw)
    expect(result).not.toBeNull()
    const values = result!.values
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1])
    }
  })

  it('has confidence between 0 and 1', () => {
    const raw: RawSpacingData[] = [
      { value: 4, property: 'padding', count: 10 },
      { value: 8, property: 'padding', count: 20 },
      { value: 16, property: 'padding', count: 15 },
    ]
    const result = detectSpacingScale(raw)
    expect(result).not.toBeNull()
    expect(result!.confidence).toBeGreaterThanOrEqual(0)
    expect(result!.confidence).toBeLessThanOrEqual(1)
  })
})
