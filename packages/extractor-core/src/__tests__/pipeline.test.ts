import { describe, it, expect } from 'vitest'
import { runPipeline } from '../pipeline'
import { sampleRawData } from './fixtures'

describe('runPipeline', () => {
  it('returns tokens with all required fields', () => {
    const { tokens } = runPipeline(sampleRawData)

    expect(tokens.colors).toBeDefined()
    expect(tokens.colors.palette).toBeInstanceOf(Array)
    expect(tokens.colors.palette.length).toBeGreaterThan(0)
    expect(tokens.colors.neutrals).toBeInstanceOf(Array)
    expect(tokens.colors.semantic).toBeDefined()
    expect(tokens.typography).toBeDefined()
    expect(tokens.typography.fonts).toBeInstanceOf(Array)
    expect(tokens.typography.scale).toBeInstanceOf(Array)
    expect(tokens.borders).toBeDefined()
    expect(tokens.shadows).toBeInstanceOf(Array)
    expect(tokens.metadata).toBeDefined()
    expect(tokens.metadata.source).toBe('https://example.com')
  })

  it('includes heuristics in layers', () => {
    const { layersUsed } = runPipeline(sampleRawData)
    expect(layersUsed).toContain('heuristics')
  })

  it('detects css-vars layer when cssVars have colors', () => {
    const { layersUsed } = runPipeline(sampleRawData)
    expect(layersUsed).toContain('css-vars')
  })

  it('skips css-vars layer when no cssVars', () => {
    const data = { ...sampleRawData, cssVars: {} }
    const { layersUsed } = runPipeline(data)
    expect(layersUsed).not.toContain('css-vars')
  })

  it('detects framework from tailwind class names', () => {
    const { layersUsed } = runPipeline(sampleRawData)
    expect(layersUsed.some(l => l.startsWith('framework:'))).toBe(true)
  })

  it('assigns color roles', () => {
    const { tokens } = runPipeline(sampleRawData)
    // With CSS vars providing primary, we should get at least primary assigned
    expect(tokens.colors.primary || tokens.colors.accent || tokens.colors.background).toBeTruthy()
  })

  it('caps palette at 20 colors', () => {
    const { tokens } = runPipeline(sampleRawData)
    expect(tokens.colors.palette.length).toBeLessThanOrEqual(20)
  })

  it('caps shadows at 10', () => {
    const { tokens } = runPipeline(sampleRawData)
    expect(tokens.shadows.length).toBeLessThanOrEqual(10)
  })

  it('calculates confidence between 0 and 1', () => {
    const { tokens } = runPipeline(sampleRawData)
    expect(tokens.metadata.confidence).toBeGreaterThanOrEqual(0)
    expect(tokens.metadata.confidence).toBeLessThanOrEqual(1)
  })
})
