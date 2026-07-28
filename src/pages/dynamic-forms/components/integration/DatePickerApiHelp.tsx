interface DatePickerApiHelpProps {
  fieldKey: string;
  fieldLabel?: string;
}

export function DatePickerApiHelp({ fieldKey, fieldLabel }: DatePickerApiHelpProps) {
  const sampleInbound = `{
  "data": {
    "dateRange": {
      "from": "2026-07-01",
      "to": "2026-07-22"
    }
  }
}`;

  const sampleOutbound = `{
  "${fieldKey}": {
    "mode": "custom",
    "from": "2026-07-01",
    "to": "2026-07-22"
  }
}`;

  return (
    <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
      {fieldLabel && (
        <p className="text-xs font-semibold text-gray-text">{fieldLabel}</p>
      )}
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-text">API integration</p>
      <ol className="list-decimal space-y-2 pl-4 text-[11px] leading-relaxed text-gray-text-muted">
        <li>
          Field key: <code className="rounded bg-gray-elevated px-1 font-mono text-gray-text">{fieldKey}</code>
        </li>
        <li>
          Open the <strong className="font-medium text-gray-text">Logic</strong> tab → add your API URL → click{' '}
          <strong className="font-medium text-gray-text">Test</strong>.
        </li>
        <li>
          Under <strong className="font-medium text-gray-text">Response mapping</strong>, set response key{' '}
          <code className="rounded bg-gray-elevated px-1 font-mono">data.dateRange</code> → select this Date Picker →
          click <strong className="font-medium text-gray-text">Apply logic</strong>.
        </li>
        <li>
          On submit, your API receives the selected range under{' '}
          <code className="rounded bg-gray-elevated px-1 font-mono">{fieldKey}</code> (see example below).
        </li>
      </ol>

      <div className="space-y-1.5">
        <p className="text-[11px] font-medium text-gray-text">Load from API (sample response)</p>
        <pre className="overflow-x-auto rounded-md border border-gray-border bg-gray-elevated p-3 font-mono text-[10px] leading-relaxed text-gray-text">
          {sampleInbound}
        </pre>
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] font-medium text-gray-text">Send to API (on form submit)</p>
        <pre className="overflow-x-auto rounded-md border border-gray-border bg-gray-elevated p-3 font-mono text-[10px] leading-relaxed text-gray-text">
          {sampleOutbound}
        </pre>
      </div>
    </div>
  );
}
