import { describe, it, expect } from 'vitest'
import { clusterColors, clustersToTokens, separateNeutrals, isNeutral } from '../normalize/colors'
import type { RawColorData } from '../types'

describe('clusterColors', () => {
  it('groups identical colors', () => {
    const raw: RawColorData[] = [
      { value: '#ff0000', property: 'color', selector: '', count: 5 },
      { value: '#ff0000', property: 'backgroundColor', selector: '', count: 3 },
    ]
    const clusters = clusterColors(raw)
    expect(clusters).toHaveLength(1)
    expect(clusters[0].frequency).toBe(8)
  })

  it('groups perceptually similar colors', () => {
    const raw: RawColorData[] = [
      { value: '#3b82f6', property: 'color', selector: '', count: 5 },
      { value: '#3b83f6', property: 'color', selector: '', count: 3 }, // 1 unit off
    ]
    const clusters = clusterColors(raw)
    expect(clusters).toHaveLength(1)
  })

  it('keeps distinct colors separate', () => {
    const raw: RawColorData[] = [
      { value: '#ff0000', property: 'color', selector: '', count: 5 },
      { value: '#0000ff', property: 'color', selector: '', count: 5 },
    ]
    const clusters = clusterColors(raw)
    expect(clusters).toHaveLength(2)
  })

  it('sorts clusters by frequency', () => {
    const raw: RawColorData[] = [
      { value: '#0000ff', property: 'color', selector: '', count: 2 },
      { value: '#ff0000', property: 'color', selector: '', count: 10 },
    ]
    const clusters = clusterColors(raw)
    expect(clusters[0].representative).toBe('#ff0000')
  })

  it('handles rgb format', () => {
    const raw: RawColorData[] = [
      { value: 'rgb(255, 0, 0)', property: 'color', selector: '', count: 3 },
    ]
    const clusters = clusterColors(raw)
    expect(clusters).toHaveLength(1)
    expect(clusters[0].representative).toBe('#ff0000')
  })

  it('handles hsl format', () => {
    const raw: RawColorData[] = [
      { value: 'hsl(0, 100, 50)', property: 'color', selector: '', count: 3 },
    ]
    const clusters = clusterColors(raw)
    expect(clusters).toHaveLength(1)
  })
})

describe('clustersToTokens', () => {
  it('converts clusters to ColorToken array', () => {
    const raw: RawColorData[] = [
      { value: '#3b82f6', property: 'color', selector: '', count: 5 },
    ]
    const clusters = clusterColors(raw)
    const tokens = clustersToTokens(clusters)

    expect(tokens).toHaveLength(1)
    expect(tokens[0].hex).toBe('#3b82f6')
    expect(tokens[0].hsl).toBeDefined()
    expect(tokens[0].hsl.h).toBeTypeOf('number')
    expect(tokens[0].hsl.s).toBeTypeOf('number')
    expect(tokens[0].hsl.l).toBeTypeOf('number')
    expect(tokens[0].frequency).toBe(5)
  })
})

describe('isNeutral', () => {
  it('returns true for pure gray (s=0)', () => {
    expect(isNeutral({ s: 0, l: 50 })).toBe(true)
  })

  it('returns true for low saturation', () => {
    expect(isNeutral({ s: 10, l: 50 })).toBe(true)
  })

  it('returns false for saturated colors', () => {
    expect(isNeutral({ s: 50, l: 50 })).toBe(false)
  })

  it('returns true for desaturated near-white', () => {
    expect(isNeutral({ s: 20, l: 95 })).toBe(true)
  })

  it('returns true for desaturated near-black', () => {
    expect(isNeutral({ s: 20, l: 10 })).toBe(true)
  })

  it('returns false for medium saturation mid-lightness', () => {
    expect(isNeutral({ s: 20, l: 50 })).toBe(false)
  })
})

describe('separateNeutrals', () => {
  it('splits chromatic and neutral colors', () => {
    const raw: RawColorData[] = [
      { value: '#3b82f6', property: 'color', selector: '', count: 5 }, // blue - chromatic
      { value: '#808080', property: 'color', selector: '', count: 3 }, // gray - neutral
      { value: '#ffffff', property: 'color', selector: '', count: 2 }, // white - neutral
    ]
    const clusters = clusterColors(raw)
    const tokens = clustersToTokens(clusters)
    const { chromatic, neutrals } = separateNeutrals(tokens)

    expect(chromatic.length).toBeGreaterThan(0)
    expect(neutrals.length).toBeGreaterThan(0)
  })

  it('sorts neutrals by lightness ascending', () => {
    const raw: RawColorData[] = [
      { value: '#ffffff', property: 'color', selector: '', count: 5 },
      { value: '#000000', property: 'color', selector: '', count: 5 },
      { value: '#808080', property: 'color', selector: '', count: 5 },
    ]
    const clusters = clusterColors(raw)
    const tokens = clustersToTokens(clusters)
    const { neutrals } = separateNeutrals(tokens)

    for (let i = 1; i < neutrals.length; i++) {
      expect(neutrals[i].hsl.l).toBeGreaterThanOrEqual(neutrals[i - 1].hsl.l)
    }
  })
})
