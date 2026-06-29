import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PeriodeProvider } from "@/lib/periode";

export const Route = createFileRoute("/_authenticated/app")({
  component: () => (
    <PeriodeProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </PeriodeProvider>
  ),
});
