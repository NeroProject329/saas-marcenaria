import AppShell from "@/components/layout/AppShell";
import { TransitionProvider } from "@/motion/TransitionProvider";
import { AuthProvider } from "@/auth/AuthProvider";
import AuthGate from "@/auth/AuthGate";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <TransitionProvider>
      <AuthProvider>
        <AuthGate>
          <AppShell>{children}</AppShell>
        </AuthGate>
      </AuthProvider>
    </TransitionProvider>
  );
}