import Script from "next/script";
import { AuthProvider } from "@/auth/AuthProvider";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
      />

      <div className="safe-x mx-auto flex min-h-dvh w-full items-center justify-center px-3 py-10">
        <div className="w-full max-w-[520px]">{children}</div>
      </div>
    </AuthProvider>
  );
}