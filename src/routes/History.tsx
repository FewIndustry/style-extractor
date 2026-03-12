import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Globe, FileText, Clock, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import type { ExtractionJob } from '@/types/tokens'

export function History() {
  const navigate = useNavigate()
  const [jobs, setJobs] = useState<ExtractionJob[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadJobs()
  }, [])

  const loadJobs = async () => {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (!error && data) {
      setJobs(data as ExtractionJob[])
    }
    setLoading(false)
  }

  const deleteJob = async (id: string) => {
    await supabase.from('jobs').delete().eq('id', id)
    setJobs(prev => prev.filter(j => j.id !== id))
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  const statusColors: Record<string, string> = {
    pending: 'text-warning',
    processing: 'text-accent',
    complete: 'text-success',
    failed: 'text-error',
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-text-muted hover:text-text transition-colors cursor-pointer"
          >
            <ArrowLeft size={18} />
            Back
          </button>
          <h1 className="text-lg font-semibold text-text">Extraction History</h1>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-8">
        {loading ? (
          <p className="text-text-muted text-center py-20">Loading...</p>
        ) : jobs.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-text-muted mb-4">No extractions yet</p>
            <Button onClick={() => navigate('/')}>Start Extracting</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <Card key={job.id} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-lg bg-bg-hover flex items-center justify-center shrink-0">
                    {job.source_type === 'url' ? (
                      <Globe size={18} className="text-text-dim" />
                    ) : (
                      <FileText size={18} className="text-text-dim" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text truncate">
                      {job.source_url || 'Unknown source'}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className={`text-xs font-medium ${statusColors[job.status]}`}>
                        {job.status}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-text-dim">
                        <Clock size={12} />
                        {formatDate(job.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => deleteJob(job.id)}
                  className="text-text-dim hover:text-error transition-colors cursor-pointer shrink-0 p-2"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
