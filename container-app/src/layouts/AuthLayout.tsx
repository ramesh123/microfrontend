import { Outlet } from "react-router-dom";

/** Bare layout (no chrome) for container-owned auth/landing-style pages. */
export function AuthLayout() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background">
      <Outlet />
    </div>
  );
}
