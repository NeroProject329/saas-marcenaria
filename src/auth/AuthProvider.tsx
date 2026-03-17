"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { clearToken, getToken, setToken } from "@/lib/auth";

type Subscription = {
  plan?: string;
  status?: string;
  source?: string;
  endsAt?: string | null;
  daysLeft?: number | null;
  cancelAtPeriodEnd?: boolean;
};

type Me = {
  id?: string;
  name?: string;
  email?: string;
  plan?: string;
  salonId?: string | null;
};

type RegisterPayload = {
  name: string;
  email: string;
  password: string;
  salonName: string;
};

type GoogleAuthPayload = {
  credential: string;
  salonName?: string;
};

type GoogleAuthResult =
  | { ok: true }
  | { ok: false; code: "SALON_NAME_REQUIRED"; message: string };

type AuthState = {
  status: "loading" | "guest" | "authed";
  me: Me | null;
  subscription: Subscription | null;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  loginWithGoogle: (payload: GoogleAuthPayload) => Promise<GoogleAuthResult>;
  logout: () => void;
  refreshMe: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthState["status"]>("loading");
  const [me, setMe] = useState<Me | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);

  const refreshMe = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setMe(null);
      setSubscription(null);
      setStatus("guest");
      return;
    }

    try {
      const data: any = await apiFetch("/api/auth/me", { auth: true });

      const user = data?.user ?? data ?? null;
      const sub = data?.subscription ?? null;

      const salonId = user?.salon?.id || user?.salonId || null;
      const plan = sub?.plan || user?.salon?.plan || user?.plan || "FREE";

      setMe({
        id: user?.id,
        name: user?.name,
        email: user?.email,
        plan,
        salonId,
      });

      setSubscription(sub || null);
      setStatus("authed");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        clearToken();
      }
      setMe(null);
      setSubscription(null);
      setStatus("guest");
    }
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  useEffect(() => {
    const onLogout = () => {
      setMe(null);
      setSubscription(null);
      setStatus("guest");
    };
    window.addEventListener("auth:logout", onLogout as EventListener);
    return() => window.removeEventListener("auth:logout", onLogout as EventListener);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const data: any = await apiFetch("/api/auth/login", {
        method: "POST",
        auth: false,
        json: { email, password },
      });

      const token =
        data?.token || data?.accessToken || data?.jwt || data?.data?.token || null;

      if (!token) {
        throw new Error("Login não retornou token.");
      }

      setToken(token);
      await refreshMe();
    },
    [refreshMe]
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const data: any = await apiFetch("/api/auth/register", {
        method: "POST",
        auth: false,
        json: payload,
      });

      const token =
        data?.token || data?.accessToken || data?.jwt || data?.data?.token || null;

      if (!token) {
        throw new Error("Cadastro não retornou token.");
      }

      setToken(token);
      await refreshMe();
    },
    [refreshMe]
  );

  const loginWithGoogle = useCallback(
    async (payload: GoogleAuthPayload): Promise<GoogleAuthResult> => {
      try {
        const data: any = await apiFetch("/api/auth/google", {
          method: "POST",
          auth: false,
          json: payload,
        });

        const token =
          data?.token || data?.accessToken || data?.jwt || data?.data?.token || null;

        if (!token) {
          throw new Error("Login com Google não retornou token.");
        }

        setToken(token);
        await refreshMe();

        return { ok: true };
      } catch (e) {
        if (e instanceof ApiError && e.status === 409 && e.data?.code === "SALON_NAME_REQUIRED") {
          return {
            ok: false,
            code: "SALON_NAME_REQUIRED",
            message: e.data?.message || "Informe o nome da marcenaria para concluir o cadastro.",
          };
        }

        throw e;
      }
    },
    [refreshMe]
  );

  const logout = useCallback(() => {
    clearToken();
    setMe(null);
    setSubscription(null);
    setStatus("guest");
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      status,
      me,
      subscription,
      login,
      register,
      loginWithGoogle,
      logout,
      refreshMe,
    }),
    [status, me, subscription, login, register, loginWithGoogle, logout, refreshMe]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}