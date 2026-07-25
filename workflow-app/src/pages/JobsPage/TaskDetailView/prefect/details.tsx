import React, { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { fetchFlowRunDetails } from './prefectapi'
import { getDisplayErrorMessage } from '@/utils/exceptionHelper'

type FlowDetails = any

interface Props {
    flowId: string
    className?: string
}

function formatTime(iso?: string) {
    if (!iso) return '—'
    try {
        return new Date(iso).toLocaleString()
    } catch {
        return iso
    }
}

export default function FlowRunDetails({ flowId, className = '' }: Props) {
    const [data, setData] = useState<FlowDetails | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let mounted = true
        async function load() {
            if (!flowId) return
            setLoading(true)
            setError(null)
            try {
                console.debug('[prefectdetails] requesting details for:', flowId)
                const json = await fetchFlowRunDetails(flowId)
                console.debug('[prefectdetails] response:', json)
                if (mounted) setData(json)
            } catch (err: unknown) {
                console.error('[prefectdetails] load error:', err)
                if (mounted) setError(getDisplayErrorMessage(err, 'Failed to load details'))
            } finally {
                if (mounted) setLoading(false)
            }
        }

        load()
        return () => {
            mounted = false
        }
    }, [flowId])

    if (loading) {
        return (
            <div className={`flex min-h-[12rem] w-full flex-col items-center justify-center gap-2 py-6 ${className}`}>
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
                <span className="text-sm text-muted-foreground">Loading details…</span>
            </div>
        )
    }
    if (error) return <div className={`text-sm text-red-600 ${className}`}>{error}</div>
    if (!data) return null

    return (
        <div className={className}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                        <div className="text-xs text-muted-foreground font-medium">Run Count</div>
                        <div className="text-sm font-normal">{data.run_count ?? '—'}</div>
                    </div>
                    <div>
                        <div className="text-xs text-muted-foreground font-medium">Name</div>
                        <div className="text-sm font-normal">{data.name}</div>
                    </div>
                    <div>
                        <div className="text-xs text-muted-foreground font-medium">Created</div>
                        <div className="text-sm font-normal">{formatTime(data.created)}</div>
                    </div>
                    <div>
                        <div className="text-xs text-muted-foreground font-medium">Tags</div>
                        <div className="flex flex-wrap gap-2 mt-1 text-sm">
                            {Array.isArray(data.tags) && data.tags.length > 0 ? (
                                data.tags.map((t: string) => (
                                    <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                                ))
                            ) : (
                                <div className=" text-sm font-normal">None</div>
                            )}
                        </div>
                    </div>
                    <div>
                        <div className="text-xs text-muted-foreground font-medium">Updated</div>
                        <div className="font-normal text-sm">{formatTime(data.updated)}</div>
                    </div>
                    <div>
                        <div className="text-xs text-muted-foreground font-medium">State</div>
                        <div className="font-normal text-sm">
                            <Badge variant="outline">{data.state_name || data.state?.name || data.state_type}</Badge>
                        </div>
                    </div>
                    <div>
                        <div className="text-xs text-muted-foreground font-medium">Duration</div>
                        <div className="font-medium text-sm">{typeof data.total_run_time === 'number' ? `${data.total_run_time.toFixed(2)}s` : '—'}</div>
                    </div>
                    <div className="col-span-2 border-b">
                        <div className="text-xs text-muted-foreground font-medium">State Message</div>
                        <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-md border bg-muted/30 p-2 text-xs">{data.state?.message || 'None'}</pre>
                    </div>
                    <div>
                        <div className="text-xs text-muted-foreground font-medium">Flow Version</div>
                        <div className="text-sm font-normal">{data.flow_version ?? '—'}</div>
                    </div>
                    <div>
                        <div className="text-xs text-muted-foreground font-medium">Retries</div>
                        <div className="text-sm font-normal">{data.empirical_policy?.retries ?? '—'}</div>
                    </div>
                    <div>
                        <div className="text-xs text-muted-foreground font-medium">Retry Delay</div>
                        <div className="text-sm font-normal">{data.empirical_policy?.retry_delay ?? data.empirical_policy?.retry_delay_seconds ?? '—'}</div>
                    </div>


                    
            </div>
        </div>
    )
}
