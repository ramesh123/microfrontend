import React, { useEffect, useState } from 'react'
import { fetchWithFallback } from './Insights'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, RefreshCw, CheckCircle, MessageSquarePlus } from 'lucide-react'

type ActionStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE'

type ActionItem = {
    id: string
    title: string
    from?: string
    assignedTo?: string
    status: ActionStatus
    time?: string
}

const MOCK_ACTIONS: ActionItem[] = [
    {
        id: 'a1',
        title: 'Investigate Product X supply in Tenali',
        from: 'Sales dip insight',
        assignedTo: 'Ops Team',
        status: 'OPEN',
        time: '2 hours ago',
    },
    {
        id: 'a2',
        title: 'Review pricing strategy for Product Y in North',
        from: 'Proactive insight',
        assignedTo: 'Pricing Team',
        status: 'IN_PROGRESS',
        time: '1 day ago',
    },
    {
        id: 'a3',
        title: 'Analyze demand forecast accuracy',
        from: 'Monthly review',
        assignedTo: 'Analytics Team',
        status: 'DONE',
        time: '3 days ago',
    },
]

export default function Decisions({ dataUrl }: { dataUrl?: string }) {
    const [actions, setActions] = useState<ActionItem[]>(MOCK_ACTIONS)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        let mounted = true
        setLoading(true)
        fetchWithFallback<ActionItem[]>(dataUrl, MOCK_ACTIONS).then((d) => {
            if (!mounted) return
            setActions(d)
            setLoading(false)
        })
        return () => {
            mounted = false
        }
    }, [dataUrl])

    function markDone(id: string) {
        setActions((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'DONE' } : a)))
    }

    const open = actions.filter((a) => a.status === 'OPEN')
    const inProgress = actions.filter((a) => a.status === 'IN_PROGRESS')
    const done = actions.filter((a) => a.status === 'DONE')

    function ActionCard({ a }: { a: ActionItem }) {
        const statusBadge =
            a.status === 'OPEN' ? (
                <Badge variant="outline" className="text-xs bg-red-50 text-red-600">OPEN</Badge>
            ) : a.status === 'IN_PROGRESS' ? (
                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700">IN PROGRESS</Badge>
            ) : (
                <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700">DONE</Badge>
            )

        return (
            <Card className="mb-2 !px-1 !py-0 gap-0">
                <CardHeader className="!px-2 !pt-2">
                    <div className="flex justify-between items-start gap-3">
                        <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                                  {a.status === 'OPEN' && <Clock className="h-4 w-4 text-red-600" />}
                                  {a.status === 'OPEN' && <span className="inline-block h-2 w-2 rounded-full bg-red-600" />}

                                  {a.status === 'IN_PROGRESS' && <MessageSquarePlus className="h-4 w-4 text-amber-600" />}
                                  {a.status === 'IN_PROGRESS' && <span className="inline-block h-2 w-2 rounded-full bg-amber-600" />}

                                  {a.status === 'DONE' && <CheckCircle className="h-4 w-4 text-emerald-600" />}
                                  {a.status === 'DONE' && <span className="inline-block h-2 w-2 rounded-full bg-emerald-600" />}

                                  <CardTitle className="font-semibold text-sm mb-1">{a.title}</CardTitle>
                            </div>

                            <div className="grid grid-cols-3 gap-3 text-sm">
                                <div>
                                    <div className="text-sm text-slate-600">From</div>
                                    <div className="truncate">{a.from}</div>
                                </div>
                                <div>
                                    <div className="text-sm text-slate-600">Assigned</div>
                                    <div className="truncate">{a.assignedTo}</div>
                                </div>
                                <div>
                                    <div className="text-sm text-slate-600">Status</div>
                                    <div className="mt-1">{statusBadge}</div>
                                </div>
                            </div>
                        </div>

                        <div className="text-xs">{a.time}</div>
                    </div>
                </CardHeader>
                <CardContent className="!pt-0 px-2 pb-2">
                    <div className="flex gap-2">
                        {a.status == 'OPEN' && (
                            <div className='flex items-center gap-3'>
                                <Button size="sm" onClick={() => markDone(a.id)} className="!px-2 !h-7">Mark Done</Button>
                                <Button variant="outline" size="sm" className="!px-2 !h-7">Add Feedback</Button>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className=" py-0 p-2 w-full text-sm">
            <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm pb-2">
                <div>
                    <h2 className="text-lg font-semibold mb-0">Decisions</h2>
                    <div className="text-sm text-slate-600">Track actions and close the decision loop</div>
                </div>
                <div className="mt-2 border-b border-slate-200" />
            </div>
            {loading && <div className="mb-3 text-sm text-slate-500">Loading...</div>}

            <section className="mb-2">
                <h3 className="text-lg font-medium mb-2">Open Actions</h3>
                {open.length === 0 ? <div className="text-sm">No open actions</div> : open.map((a) => <ActionCard key={a.id} a={a} />)}
            </section>

            <section className="mb-2">
                <h3 className="text-lg font-medium mb-2">In Progress</h3>
                {inProgress.length === 0 ? <div className="text-sm">No actions in progress</div> : inProgress.map((a) => <ActionCard key={a.id} a={a} />)}
            </section>

            <section>
                <h3 className="text-lg font-medium mb-2">Completed</h3>
                {done.length === 0 ? <div className="text-sm ">No completed actions</div> : done.map((a) => <ActionCard key={a.id} a={a} />)}
            </section>
        </div>
    )
}
