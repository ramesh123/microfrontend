/**
 * Container-owned page rendered inside AppShellLayout — demonstrates the
 * pattern for a micro-frontend that doesn't ship its own header/sidebar.
 * Reachable directly at /_mfe-unavailable; not part of the main catch-all.
 */
export function MfeUnavailablePage() {
  return (
    <div className="p-6">
      <h1 className="text-lg font-semibold text-foreground">
        This is a container-owned page
      </h1>
      <p className="mt-2 max-w-lg text-sm text-muted-foreground">
        It renders inside AppShellLayout (Header + Sidebar + Footer). Use this
        layout for any future micro-frontend that does not bring its own
        chrome — workflow-app brings its own, so it is mounted full-bleed
        instead (see routes/AppRoutes.tsx).
      </p>
    </div>
  );
}
