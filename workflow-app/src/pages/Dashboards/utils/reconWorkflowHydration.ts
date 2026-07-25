/** True when workflow record matches the :workflowName route segment (database id or flow id). */
export function workflowMatchesRouteId(workflow: unknown, routeId: string | undefined): boolean {
  if (!workflow || !routeId) return false
  const w = workflow as Record<string, unknown>
  const route = String(routeId)
  const candidates = [w.id, w.workflow_id, w.flow_id].map((v) => (v == null ? "" : String(v)))
  return candidates.some((c) => c === route)
}

/**
 * After getWorkflowByIdApi, flow_id is the real Prefect/UUID id and differs from the URL database id.
 * While still a stub, id and flow_id are both set to the route id.
 */
export function isReconWorkflowFlowIdResolved(workflow: unknown, routeId: string | undefined): boolean {
  if (!workflow || !routeId) return false
  const w = workflow as Record<string, unknown>
  const flowId = String(w.flow_id ?? "").trim()
  if (!flowId) return false
  return flowId !== String(routeId)
}
