export const buildDateFilterPayload = (flowId, startDate?, endDate?) => {
  const today = new Date().toISOString().slice(0, 10);

  const from = startDate ? new Date(startDate).toISOString().slice(0, 10) : today;
  const to   = endDate   ? new Date(endDate).toISOString().slice(0, 10)   : today;

  return {
    cross_filter: [{ key: "DATE", cond: "equals", value: [from, to] }],
    filters: [{ key: "flow_id", cond: "equals", value: flowId }]
  };
};
