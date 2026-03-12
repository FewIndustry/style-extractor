import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { DesignTokens } from '@/types/tokens'

interface JobState {
  status: 'pending' | 'processing' | 'complete' | 'failed'
  tokens: DesignTokens | null
  error: string | null
}

/**
 * Subscribe to realtime updates for a Supabase extraction job.
 * Used in production when extraction runs server-side.
 */
export function useRealtimeJob(jobId: string | null) {
  const [state, setState] = useState<JobState>({
    status: 'pending',
    tokens: null,
    error: null,
  })

  useEffect(() => {
    if (!jobId) return

    const channel = supabase
      .channel(`job:${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'jobs',
          filter: `id=eq.${jobId}`,
        },
        async (payload) => {
          const newStatus = payload.new.status as JobState['status']
          setState(prev => ({ ...prev, status: newStatus }))

          if (newStatus === 'complete') {
            const { data } = await supabase
              .from('results')
              .select('tokens')
              .eq('job_id', jobId)
              .single()

            if (data) {
              setState({ status: 'complete', tokens: data.tokens as DesignTokens, error: null })
            }
          } else if (newStatus === 'failed') {
            setState(prev => ({
              ...prev,
              status: 'failed',
              error: (payload.new as Record<string, unknown>).error_message as string || 'Extraction failed',
            }))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [jobId])

  return state
}
