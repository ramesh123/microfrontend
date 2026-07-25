/** Shared abort scope for workflow canvas load + eager source preview. */
let activeController: AbortController | null = null;

export function startWorkflowLoadSession(): AbortSignal {
  abortWorkflowLoadSession();
  activeController = new AbortController();
  return activeController.signal;
}

export function getWorkflowLoadSignal(): AbortSignal | undefined {
  return activeController?.signal;
}

export function abortWorkflowLoadSession(): void {
  activeController?.abort();
  activeController = null;
}
