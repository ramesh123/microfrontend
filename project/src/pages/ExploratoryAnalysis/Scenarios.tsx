import React, { useEffect, useState } from 'react'
import { fetchWithFallback } from './Insights'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { Play, Plus } from 'lucide-react'

type Metric = {
    key: string
    label: string
    baseline: string | number
    scenario: string | number
}

type Scenario = {
    id: string
    name: string
    active?: boolean
    editorText?: string
    metrics: Metric[]
}

const MOCK_SCENARIOS: Scenario[] = [
    {
        id: 'baseline',
        name: 'Baseline',
        active: true,
        editorText: 'Baseline scenario uses current actual values',
        metrics: [
            { key: 'sales_gap', label: 'Sales Gap (TMT)', baseline: 120, scenario: 120 },
            { key: 'achievement', label: 'Achievement %', baseline: '92%', scenario: '92%' },
        ],
    },
    {
        id: 'demand_plus5_north',
        name: 'Demand +5% North',
        active: false,
        editorText: 'Simulate +5% demand in North region',
        metrics: [
            { key: 'sales_gap', label: 'Sales Gap (TMT)', baseline: 120, scenario: 155 },
            { key: 'achievement', label: 'Achievement %', baseline: '92%', scenario: '88%' },
        ],
    },
]

export default function Scenarios({ dataUrl }: { dataUrl?: string }) {
    const [scenarios, setScenarios] = useState<Scenario[]>(MOCK_SCENARIOS)
    const [loading, setLoading] = useState(false)
    const [selectedId, setSelectedId] = useState<string>(MOCK_SCENARIOS[0].id)
    const [multiplier, setMultiplier] = useState<number>(1.05)

    useEffect(() => {
        let mounted = true
        setLoading(true)
        fetchWithFallback<Scenario[]>(dataUrl, MOCK_SCENARIOS).then((d) => {
            if (!mounted) return
            setScenarios(d)
            // pick first or keep previous selection if exists
            setSelectedId((prev) => (d.find((s) => s.id === prev) ? prev : d[0]?.id))
            setLoading(false)
        })
        return () => {
            mounted = false
        }
    }, [dataUrl])

    const selected = scenarios.find((s) => s.id === selectedId) || scenarios[0]
    const baseline = scenarios.find((s) => s.id === 'baseline') || scenarios[0]

    function renderImpact(baselineVal: string | number, scenarioVal: string | number) {
        // attempt numeric diff when possible
        const bn = typeof baselineVal === 'number' ? baselineVal : parseFloat(String(baselineVal))
        const sn = typeof scenarioVal === 'number' ? scenarioVal : parseFloat(String(scenarioVal))
        if (!Number.isFinite(bn) || !Number.isFinite(sn)) {
            return String(scenarioVal)
        }
        const diff = (sn - bn)
        const sign = diff > 0 ? '+' : ''
        const cls = diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-500' : 'text-slate-600'
        return <span className={cls}>{sign}{diff}</span>
    }

    return (
        <div className="px-1 py-0 w-full text-sm">
            <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm pb-2">
                <div>
                    <h2 className="text-lg font-semibold mb-0">Scenarios</h2>
                    <div className="text-sm text-slate-600">Scenario planning and quick comparison</div>
                </div>
                <div className="mt-0 border-b border-slate-200" />
            </div>
            {loading && <div className="mb-4 text-sm text-slate-500">Loading...</div>}

            <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1 border rounded-lg p-3 bg-white">
                    <div className="flex items-center justify-between mb-3 px-1">
                        <div className="text-sm font-medium">Scenarios List</div>
                        <Button size="sm" className="!px-2 !h-7"><Plus /></Button>
                    </div>
                    <div className="space-y-2">
                        {scenarios.map((s) => (
                            <Button
                                key={s.id}
                                onClick={() => setSelectedId(s.id)}
                                variant={s.id === selectedId ? 'default' : 'ghost'}
                                className={`w-full text-left p-2 text-sm rounded ${s.id === selectedId ? 'border border-blue-200 bg-blue-50' : 'bg-slate-50'}`}>
                                <div className="flex items-center justify-between gap-2 w-full">
                                    <div className="text-sm truncate flex-1 text-left">{s.name}</div>
                                    {s.active && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded ml-2">Active</span>}
                                </div>
                            </Button>
                        ))}
                    </div>
                </div>

                <div className="col-span-2 space-y-1">
                    <div className="border rounded-lg p-3 flex flex-col items-stretch">
                        {selected?.id === 'baseline' && (
                            <div className="space-y-2">
                                <div className='text-lg font-semibold'>Scenario Editor</div>
                                <div className="py-4 text-center">{selected?.editorText || 'No scenario selected'}</div>
                            </div>
                        )}

                        {selected?.id === 'demand_plus5_north' && (
                            <div className="space-y-1">
                                <div className='text-lg font-semibold'>Scenario Editor</div>
                                <div className="text-sm">Demand Multiplier (North)</div>
                                <div className="flex items-center gap-3">
                                    <div className="flex-1">
                                        <Slider value={[multiplier]} min={0.8} max={1.5} step={0.01} onValueChange={(v) => setMultiplier(Number(v[0]))} />
                                    </div>
                                    <div className="w-20">
                                        <Input className="!h-7 !w-14" value={String(multiplier.toFixed(2))} onChange={(e) => setMultiplier(parseFloat(e.target.value || '0'))} />
                                    </div>
                                </div>

                                <Button className="!w-full !py-3 rounded-lg" onClick={() => console.log('Run scenario', selected?.id, multiplier)}>
                                    <Play /> Run Scenario
                                </Button>
                            </div>
                        )}
                        {selected && !['baseline', 'demand_plus5_north'].includes(selected.id) && (
                            <div className="py-4 text-sm">{selected?.editorText || 'No scenario selected'}</div>
                        )}
                    </div>

                    <div className="border rounded-lg p-3 bg-white">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="font-medium">Comparison</div>
                            <div className="text-sm text-slate-400">Compare baseline vs scenario</div>
                        </div>

                        <div className="w-full">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="font-semibold">Metric</TableHead>
                                        <TableHead className="font-semibold text-right">Baseline</TableHead>
                                        <TableHead className="font-semibold text-right">Scenario</TableHead>
                                        <TableHead className="font-semibold text-right">Impact</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {baseline && selected && baseline.metrics.map((m) => {
                                        const selMetric = selected.metrics.find((sm) => sm.key === m.key) || m
                                        return (
                                            <TableRow key={m.key} className="border-t">
                                                <TableCell className="py-2">{m.label}</TableCell>
                                                <TableCell className="py-2 text-right">{m.baseline}</TableCell>
                                                <TableCell className="py-2 text-right">{selMetric.scenario}</TableCell>
                                                <TableCell className="py-2 text-right">{renderImpact(m.baseline, selMetric.scenario)}</TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>
            </div>
        </div>

    )
}
