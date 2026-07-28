import React, { useState, useEffect } from 'react'
import { Check, ChevronDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { apiV2 } from '@/controllers/API/api'
import { useSemanticsStore, DomainOption } from '@/stores/semanticsStore'
import {
  fetchTenantDomain,
  fetchDomains as fetchDomainsApi,
  type ContextDomainItem,
} from '@/controllers/API/semanticsApi'

export default function Domainselection({ onSelect }: { onSelect?: (domain: DomainOption) => void }) {
  const { selectedDomain, setSelectedDomain, tenantId, isConfigView } = useSemanticsStore()

  const [domains, setDomains] = useState<DomainOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string>(selectedDomain?.domain_id ?? '')

  // Fetch domains on mount + load existing domain in config view
  useEffect(() => {
    const loadDomains = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetchDomainsApi()
        const data: DomainOption[] = (res?.domains ?? []).map((d: ContextDomainItem) => ({
          domain_id: d.domain_id,
          display_name: d.display_name ?? d.domain_id,
        }))
        setDomains(data)

        // In config view, auto-select the tenant's existing domain
        if (isConfigView && !selectedDomain) {
          try {
            const domainRes = await fetchTenantDomain(tenantId)
            if (domainRes?.domain_id) {
              const match = data.find((d) => d.domain_id === domainRes.domain_id)
              if (match) {
                setSelectedId(match.domain_id)
                setSelectedDomain(match)
              } else {
                // Domain exists but not in the list — create a placeholder
                const placeholder: DomainOption = {
                  domain_id: domainRes.domain_id,
                  display_name: domainRes.domain_id,
                }
                setDomains((prev) => [...prev, placeholder])
                setSelectedId(domainRes.domain_id)
                setSelectedDomain(placeholder)
              }
            }
          } catch {
            // No domain linked yet — that's fine
          }
        }
      } catch (err) {
        console.error('Failed to fetch domains:', err)
        setError('Failed to load domains')
        setDomains([])
      } finally {
        setLoading(false)
      }
    }
    loadDomains()
  }, [])

  const selected = domains.find((d) => d.domain_id === selectedId)

  const handleSelect = async (val: string) => {
    setSelectedId(val)
    const domain = domains.find((x) => x.domain_id === val)
    if (domain) {
      setSelectedDomain(domain)

      try {
        await apiV2.post('/tenant/domain', {
          tenant_id: tenantId,
          domain_id: domain.domain_id,
        })
      } catch (err) {
        console.error('Failed to set tenant domain:', err)
        // Continue anyway - domain selection still works locally
      }

      if (onSelect) onSelect(domain)
    }
    setOpen(false)
  }

  return (
    <div className="p-6 w-full">
      <label className="block mb-3 text-xl font-semibold text-foreground">Select Domain</label>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading domains...</span>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="text-sm text-destructive text-center py-6">{error}</div>
      )}

      {/* Domain cards when nothing selected */}
      {!loading && !error && !selected && (
        <div className="mb-4">
          <div className="grid grid-cols-1 gap-3">
            {domains.map((d) => (
              <div key={d.domain_id} className="p-3 rounded-md border border-border bg-card w-full cursor-pointer hover:border-primary/50 transition-colors" onClick={() => handleSelect(d.domain_id)}>
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded bg-muted/10 flex items-center justify-center text-sm font-medium text-muted-foreground">
                    {d.display_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-l">{d.display_name}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dropdown selector */}
      {!loading && !error && (
        <div className="flex items-center justify-center gap-3">
          <Popover open={open} onOpenChange={setOpen} modal={false}>
            <PopoverTrigger asChild>
              <Button
                role="combobox"
                aria-expanded={open}
                className="group flex items-center justify-between w-[400px] rounded-md border border-border bg-card px-3 py-2 text-sm hover:shadow-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-sm">
                      {selected ? selected.display_name : 'Choose a domain'}
                    </div>
                  </div>
                </div>
                <ChevronDown className="ml-3 h-4 w-4 opacity-60" />
              </Button>
            </PopoverTrigger>

            <PopoverContent className="p-0 w-[400px]" sideOffset={6} align="start" style={{ zIndex: 99999 }}>
              <Command>
                <CommandInput placeholder="Search domains..." />
                <CommandList className="max-h-[260px] overflow-y-auto">
                  <CommandEmpty>No domains found.</CommandEmpty>
                  <CommandGroup>
                    {domains.map((d) => (
                      <CommandItem
                        key={d.domain_id}
                        value={d.domain_id}
                        onSelect={handleSelect}
                        className="py-2"
                      >
                        <Check className={selectedId === d.domain_id ? 'mr-2 h-4 w-4 opacity-100' : 'mr-2 h-4 w-4 opacity-0'} />
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium text-sm">{d.display_name}</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  )
}
