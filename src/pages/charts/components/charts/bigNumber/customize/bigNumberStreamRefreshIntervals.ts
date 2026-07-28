/** Preset polling intervals for live stream KPI cards. Values are seconds. */
export const BIG_NUMBER_STREAM_REFRESH_INTERVALS: Array<{ value: number; label: string }> = [
  { value: 0, label: 'Off (manual only)' },
  { value: 1, label: '1 second' },
  { value: 2, label: '2 seconds' },
  { value: 5, label: '5 seconds' },
  { value: 10, label: '10 seconds' },
  { value: 15, label: '15 seconds' },
  { value: 30, label: '30 seconds' },
  { value: 60, label: '1 minute' },
  { value: 120, label: '2 minutes' },
  { value: 300, label: '5 minutes' },
  { value: 600, label: '10 minutes' },
  { value: 900, label: '15 minutes' },
  { value: 1800, label: '30 minutes' },
];
