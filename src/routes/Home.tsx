import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Palette, Type, Ruler, Sparkles, Code2, LogIn, Wand2, Sun, Moon } from 'lucide-react'
import { UrlInput } from '@/components/input/UrlInput'
import { PdfUpload } from '@/components/input/PdfUpload'
import { ColorPalette } from '@/components/results/ColorPalette'
import { TypographyPreview } from '@/components/results/TypographyPreview'
import { SpacingScale } from '@/components/results/SpacingScale'
import { ShadowsAndRadii } from '@/components/results/ShadowsAndRadii'
import { ExportPanel } from '@/components/export/ExportPanel'
import { Loading } from '@/components/ui/Loading'
import { AuthModal } from '@/components/auth/AuthModal'
import { UserMenu } from '@/components/auth/UserMenu'
import { useExtraction } from '@/hooks/useExtraction'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'

type InputMode = 'url' | 'pdf'
type ResultTab = 'colors' | 'typography' | 'spacing' | 'effects' | 'export'

export function Home() {
  const navigate = useNavigate()
  const [inputMode, setInputMode] = useState<InputMode>('url')
  const [activeTab, setActiveTab] = useState<ResultTab>('colors')
  const [showAuth, setShowAuth] = useState(false)
  const {
    status, tokens, error, layers, cached, refining, stage,
    extractFromUrl, extractFromPdf, refineWithAI, reset
  } = useExtraction()
  const { theme, toggle } = useTheme()
  const {
    user, loading: authLoading,
    signInWithEmail, signUpWithEmail, signInWithGoogle, signInWithGithub, signOut
  } = useAuth()

  const tabs: { value: ResultTab; label: string; icon: typeof Palette }[] = [
    { value: 'colors', label: 'Colors', icon: Palette },
    { value: 'typography', label: 'Typography', icon: Type },
    { value: 'spacing', label: 'Spacing', icon: Ruler },
    { value: 'effects', label: 'Effects', icon: Sparkles },
    { value: 'export', label: 'Export', icon: Code2 },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button onClick={reset} className="flex items-center gap-2 cursor-pointer">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <Palette size={16} className="text-white" />
            </div>
            <span className="font-semibold text-text">StyleExtractor</span>
          </button>

          <div className="flex items-center gap-4">
            {tokens && (
              <div className="hidden sm:flex items-center gap-2 text-xs text-text-dim">
                {cached && (
                  <span className="px-2 py-0.5 bg-warning/10 text-warning rounded text-xs">
                    Cached
                  </span>
                )}
                <span>Layers: {layers.join(', ')}</span>
                <span className="text-border">|</span>
                <span>Confidence: {Math.round((tokens.metadata.confidence || 0) * 100)}%</span>
              </div>
            )}

            <button
              onClick={toggle}
              className="p-2 text-text-dim hover:text-text transition-colors cursor-pointer"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {/* Auth */}
            {!authLoading && (
              user ? (
                <UserMenu
                  user={user}
                  onSignOut={signOut}
                  onHistory={() => navigate('/history')}
                />
              ) : (
                <button
                  onClick={() => setShowAuth(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-muted
                    hover:text-text transition-colors cursor-pointer"
                >
                  <LogIn size={16} />
                  Sign in
                </button>
              )
            )}
          </div>
        </div>
      </header>

      {/* Auth modal */}
      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          onSignInEmail={signInWithEmail}
          onSignUpEmail={signUpWithEmail}
          onSignInGoogle={signInWithGoogle}
          onSignInGithub={signInWithGithub}
        />
      )}

      {/* Main */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-10">
        {/* Input section — shown when idle or failed */}
        {(status === 'idle' || status === 'failed') && (
          <div className="flex flex-col items-center gap-8">
            <div className="text-center space-y-3">
              <h1 className="text-2xl sm:text-4xl font-bold text-text">
                Extract design tokens from any website
              </h1>
              <p className="text-text-muted text-lg max-w-xl">
                Paste a URL or upload a PDF. Get colors, typography, spacing, and
                shadows as CSS, Tailwind, or design tokens.
              </p>
            </div>

            {/* Input mode toggle */}
            <div className="flex bg-bg-elevated rounded-lg p-1 border border-border">
              <button
                onClick={() => setInputMode('url')}
                className={`px-4 py-2 text-sm rounded-md transition-colors cursor-pointer
                  ${inputMode === 'url' ? 'bg-bg-hover text-text' : 'text-text-muted hover:text-text'}`}
              >
                Website URL
              </button>
              <button
                onClick={() => setInputMode('pdf')}
                className={`px-4 py-2 text-sm rounded-md transition-colors cursor-pointer
                  ${inputMode === 'pdf' ? 'bg-bg-hover text-text' : 'text-text-muted hover:text-text'}`}
              >
                Upload PDF
              </button>
            </div>

            {/* Input */}
            {inputMode === 'url' ? (
              <UrlInput onSubmit={extractFromUrl} isLoading={false} />
            ) : (
              <PdfUpload onFileSelect={extractFromPdf} isLoading={false} />
            )}

            {error && (
              <div className="text-sm text-error bg-error/10 border border-error/20 rounded-lg px-4 py-3 max-w-2xl w-full">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Loading */}
        {status === 'processing' && <Loading stage={stage} />}

        {/* Results */}
        {status === 'complete' && tokens && (
          <div className="space-y-8">
            {/* Source info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-text">Extraction Results</h2>
                <p className="text-sm text-text-muted mt-1">
                  {tokens.metadata.source}
                  {tokens.metadata.framework && (
                    <span className="ml-2 px-2 py-0.5 bg-accent/10 text-accent rounded text-xs">
                      {tokens.metadata.framework}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {!layers.includes('ai-refine') && (
                  <button
                    onClick={refineWithAI}
                    disabled={refining}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-accent text-white rounded-lg
                      hover:bg-accent-hover transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Wand2 size={14} />
                    {refining ? 'Refining...' : 'Refine with AI'}
                  </button>
                )}
                {layers.includes('ai-refine') && (
                  <span className="px-2 py-0.5 bg-accent/10 text-accent rounded text-xs font-medium">
                    AI Refined
                  </span>
                )}
                {cached && (
                  <button
                    onClick={() => extractFromUrl(tokens.metadata.source, true)}
                    className="text-sm text-accent hover:text-accent-hover transition-colors cursor-pointer"
                  >
                    Re-extract
                  </button>
                )}
                <button
                  onClick={reset}
                  className="text-sm text-text-muted hover:text-text transition-colors cursor-pointer"
                >
                  New extraction
                </button>
              </div>
            </div>

            {/* Result tabs */}
            <div className="flex gap-1 bg-bg-elevated rounded-lg p-1 border border-border w-full sm:w-fit overflow-x-auto">
              {tabs.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setActiveTab(value)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm rounded-md transition-colors cursor-pointer
                    ${activeTab === value
                      ? 'bg-bg-hover text-text'
                      : 'text-text-muted hover:text-text'
                    }`}
                >
                  <Icon size={16} />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>

            {/* Tab content */}
            {activeTab === 'colors' && <ColorPalette colors={tokens.colors} />}
            {activeTab === 'typography' && <TypographyPreview typography={tokens.typography} />}
            {activeTab === 'spacing' && (
              tokens.spacing ? (
                <SpacingScale spacing={tokens.spacing} />
              ) : (
                <p className="text-text-muted py-10 text-center">No spacing scale detected</p>
              )
            )}
            {activeTab === 'effects' && (
              (tokens.shadows.length > 0 || tokens.borders.radii.length > 0) ? (
                <ShadowsAndRadii shadows={tokens.shadows} radii={tokens.borders.radii} />
              ) : (
                <p className="text-text-muted py-10 text-center">No shadows or border radii detected</p>
              )
            )}
            {activeTab === 'export' && <ExportPanel tokens={tokens} />}
          </div>
        )}
      </main>
    </div>
  )
}
