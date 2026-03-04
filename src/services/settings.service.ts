import { apiFetch } from "@/lib/api";

export async function getSettings() {
  return apiFetch<any>("/api/settings", { auth: true });
}

export async function updateSettings(payload: any) {
  return apiFetch<any>("/api/settings", { method: "PATCH", auth: true, json: payload });
}

export async function updateMe(payload: { name: string; phone: string; email: string }) {
  return apiFetch<any>("/api/me", { method: "PATCH", auth: true, json: payload });
}

export async function changePassword(payload: { currentPassword: string; newPassword: string }) {
  return apiFetch<any>("/api/me/password", { method: "PATCH", auth: true, json: payload });
}