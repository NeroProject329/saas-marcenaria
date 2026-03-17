"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { useAuth } from "@/auth/AuthProvider";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (
            element: HTMLElement,
            options: {
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
              shape?: "rectangular" | "pill" | "circle" | "square";
              width?: number;
              logo_alignment?: "left" | "center";
            }
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

type Props = {
  next: string;
};

export default function GoogleButton({ next }: Props) {
  const router = useRouter();
  const { loginWithGoogle } = useAuth();

  const btnRef = useRef<HTMLDivElement | null>(null);
  const initializedRef = useRef(false);

  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [needSalonName, setNeedSalonName] = useState(false);
  const [salonName, setSalonName] = useState("");
  const [savedCredential, setSavedCredential] = useState<string | null>(null);

  const finishGoogleAuth = useCallback(
    async (credential: string, salonNameArg?: string) => {
      setErr(null);
      setPending(true);

      try {
        const result = await loginWithGoogle({
          credential,
          salonName: salonNameArg?.trim() || undefined,
        });

        if (result.ok) {
          router.replace(next);
          return;
        }

        if (result.code === "SALON_NAME_REQUIRED") {
          setSavedCredential(credential);
          setNeedSalonName(true);
          setErr(null);
          return;
        }
      } catch (e: any) {
        setErr(e?.message || "Falha ao entrar com Google.");
      } finally {
        setPending(false);
      }
    },
    [loginWithGoogle, next, router]
  );

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    if (!clientId) {
      setErr("NEXT_PUBLIC_GOOGLE_CLIENT_ID não configurado.");
      return;
    }

    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;

      if (!window.google || !btnRef.current) {
        if (tries > 40) {
          window.clearInterval(timer);
          setErr("Não foi possível carregar o botão do Google.");
        }
        return;
      }

      if (initializedRef.current) {
        window.clearInterval(timer);
        return;
      }

      initializedRef.current = true;
      btnRef.current.innerHTML = "";

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          const credential = response?.credential;
          if (!credential) {
            setErr("Google não retornou a credencial.");
            return;
          }

          await finishGoogleAuth(credential);
        },
      });

      window.google.accounts.id.renderButton(btnRef.current, {
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "pill",
        width: 360,
        logo_alignment: "left",
      });

      window.clearInterval(timer);
    }, 250);

    return () => window.clearInterval(timer);
  }, [finishGoogleAuth]);

  async function onCompleteSignup() {
    if (!savedCredential) {
      setErr("Credencial do Google não encontrada. Tente novamente.");
      return;
    }

    if (!salonName.trim()) {
      setErr("Informe o nome da marcenaria para concluir.");
      return;
    }

    await finishGoogleAuth(savedCredential, salonName);
  }

  return (
  <>
    <div className="space-y-3">
      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[color:var(--line)]" />
        </div>
        <div className="relative flex justify-center">
          <span className="rounded-full border border-[color:var(--line)] bg-white/70 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[color:var(--muted)]">
            ou continue com
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <div ref={btnRef} className="flex min-h-[44px] items-center justify-center" />
        <div className="text-center text-[11px] font-semibold text-[color:var(--muted)]">
          Use sua conta Google para entrar ou criar sua conta.
        </div>
      </div>

      {err && !needSalonName ? (
        <div className="rounded-2xl border border-red-500/15 bg-red-500/10 p-3 text-sm font-semibold text-red-700">
          {err}
        </div>
      ) : null}
    </div>

    {needSalonName ? (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-4">
        <div className="w-full max-w-[460px] rounded-[28px] border border-white/20 bg-white p-5 shadow-2xl">
          <div className="text-lg font-black text-[color:var(--ink)]">
            Falta só o nome da marcenaria
          </div>

          <div className="mt-1 text-sm font-semibold text-[color:var(--muted)]">
            Sua conta Google foi validada. Agora informe o nome da marcenaria para concluir o cadastro.
          </div>

          <div className="mt-4">
            <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">
              Nome da marcenaria
            </div>
            <Input
              value={salonName}
              onChange={(e) => setSalonName(e.target.value)}
              placeholder="Ex.: Marcenaria Silva"
            />
          </div>

          {err ? (
            <div className="mt-3 rounded-2xl border border-red-500/15 bg-red-500/10 p-3 text-sm font-semibold text-red-700">
              {err}
            </div>
          ) : null}

          <div className="mt-4 flex gap-2">
            <Button
              type="button"
              variant="soft"
              className="w-full"
              disabled={pending}
              onClick={() => {
                setNeedSalonName(false);
                setSalonName("");
                setSavedCredential(null);
                setErr(null);
              }}
            >
              Cancelar
            </Button>

            <Button
              type="button"
              className="w-full"
              variant="dark"
              disabled={pending}
              onClick={onCompleteSignup}
            >
              {pending ? "Finalizando..." : "Concluir cadastro"}
            </Button>
          </div>
        </div>
      </div>
    ) : null}
  </>
);
}