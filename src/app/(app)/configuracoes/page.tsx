"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LogOut, Save, Shield, User, Building2, Image as Img } from "lucide-react";
import { useRouter } from "next/navigation";

import PageHeader from "@/components/layout/PageHeader";
import GlassCard from "@/components/ui/GlassCard";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Tabs from "@/components/ui/Tabs";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";

import { useGsapStagger } from "@/motion/useGsapStagger";
import { getSettings, updateSettings, updateMe, changePassword } from "@/services/settings.service";

type Tab = "salon" | "user" | "account";

const days = [
  { v: 0, l: "Dom" },
  { v: 1, l: "Seg" },
  { v: 2, l: "Ter" },
  { v: 3, l: "Qua" },
  { v: 4, l: "Qui" },
  { v: 5, l: "Sex" },
  { v: 6, l: "Sáb" },
];

function toDigits(v: string) {
  return String(v || "").replace(/\D/g, "");
}

function fileToDataURL(file: File) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("Falha ao ler imagem."));
    r.readAsDataURL(file);
  });
}

export default function ConfiguracoesPage() {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useGsapStagger(wrapRef, { selector: "[data-stagger]", y: 14, duration: 0.5, stagger: 0.05 });

  const tabs = useMemo(
    () => [
      { key: "salon", label: "Marcenaria" },
      { key: "user", label: "Usuário" },
      { key: "account", label: "Conta" },
    ],
    []
  );

  const [tab, setTab] = useState<Tab>("salon");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [settings, setSettingsState] = useState({
    workingDays: [1, 2, 3, 4, 5],
    openTime: "09:00",
    closeTime: "18:00",
    blockOutsideHours: false,
  });

  const [salon, setSalon] = useState({
    name: "",
    phone: "",
    address: "",
    logoUrl: "",
    logoDataUrl: "" as string | null,
  });

  const [user, setUser] = useState({ name: "", phone: "", email: "" });

  const [pwd, setPwd] = useState({ currentPassword: "", newPassword: "" });

  async function load() {
    setLoading(true);
    setMsg(null);

    try {
      // prefill localStorage (igual legado)
      try {
        const lsSalon = JSON.parse(localStorage.getItem("salon") || "null");
        if (lsSalon?.name) setSalon((p) => ({ ...p, name: lsSalon.name }));
        if (lsSalon?.phone) setSalon((p) => ({ ...p, phone: lsSalon.phone }));
        if (lsSalon?.address) setSalon((p) => ({ ...p, address: lsSalon.address }));
        if (lsSalon?.logoUrl) setSalon((p) => ({ ...p, logoUrl: lsSalon.logoUrl }));
      } catch {}

      const data = await getSettings();

      const s = data?.settings || {};
      const sl = data?.salon || {};
      const u = data?.user || null;

      setSettingsState({
        workingDays: Array.isArray(s.workingDays) ? s.workingDays : [1, 2, 3, 4, 5],
        openTime: s.openTime || "09:00",
        closeTime: s.closeTime || "18:00",
        blockOutsideHours: !!s.blockOutsideHours,
      });

      setSalon((p) => ({
        ...p,
        name: sl.name ?? p.name,
        phone: sl.phone ?? p.phone,
        address: sl.address ?? p.address,
        logoUrl: sl.logoUrl ?? p.logoUrl,
        logoDataUrl: null,
      }));

      if (u) setUser({ name: u.name || "", phone: u.phone || "", email: u.email || "" });
    } catch (e: any) {
      setMsg(e?.message || "Erro ao carregar configurações.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function saveSalonSettings() {
    setLoading(true);
    setMsg(null);

    try {
      if (!settings.workingDays.length) throw new Error("Selecione pelo menos 1 dia.");
      if (!settings.openTime) throw new Error("Informe abertura.");
      if (!settings.closeTime) throw new Error("Informe fechamento.");
      if (settings.openTime >= settings.closeTime) throw new Error("Abertura deve ser menor que fechamento.");

      const payload = {
        settings: {
          workingDays: settings.workingDays,
          openTime: settings.openTime,
          closeTime: settings.closeTime,
          blockOutsideHours: settings.blockOutsideHours,
        },
        salon: {
          name: salon.name.trim() || null,
          phone: toDigits(salon.phone) || null,
          address: salon.address.trim() || null,
          logoDataUrl: salon.logoDataUrl || null,
        },
      };

      await updateSettings(payload);

      // mantém localStorage igual legado
      try {
        localStorage.setItem(
          "salon",
          JSON.stringify({
            name: payload.salon.name,
            phone: payload.salon.phone,
            address: payload.salon.address,
            logoUrl: salon.logoUrl || "",
          })
        );
      } catch {}

      setMsg("✅ Configurações salvas!");
      await load();
    } catch (e: any) {
      setMsg(e?.message || "Erro ao salvar.");
    } finally {
      setLoading(false);
    }
  }

  async function saveUser() {
    setLoading(true);
    setMsg(null);
    try {
      await updateMe({
        name: user.name.trim(),
        phone: toDigits(user.phone),
        email: user.email.trim(),
      });

      try {
        localStorage.setItem("user", JSON.stringify({ ...user, phone: toDigits(user.phone) }));
      } catch {}

      setMsg("✅ Usuário atualizado!");
    } catch (e: any) {
      setMsg(e?.message || "Erro ao salvar usuário.");
    } finally {
      setLoading(false);
    }
  }

  async function savePassword() {
    setLoading(true);
    setMsg(null);
    try {
      if (!pwd.currentPassword || !pwd.newPassword) throw new Error("Preencha senha atual e nova senha.");
      if (pwd.newPassword.length < 6) throw new Error("Nova senha deve ter pelo menos 6 caracteres.");

      await changePassword({ currentPassword: pwd.currentPassword, newPassword: pwd.newPassword });

      setPwd({ currentPassword: "", newPassword: "" });
      setMsg("✅ Senha atualizada!");
    } catch (e: any) {
      setMsg(e?.message || "Erro ao trocar senha.");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("salon");
    router.push("/login");
  }

  async function onPickLogo(file: File | null) {
    if (!file) return;
    const maxBytes = 2 * 1024 * 1024;
    if (file.size > maxBytes) {
      setMsg("A logo é grande demais. Use até 2MB.");
      return;
    }

    try {
      const dataUrl = await fileToDataURL(file);
      setSalon((p) => ({ ...p, logoDataUrl: dataUrl, logoUrl: dataUrl }));
    } catch (e: any) {
      setMsg(e?.message || "Erro ao ler imagem.");
    }
  }

  return (
    <div ref={wrapRef} className="space-y-4">
      <div data-stagger>
        <PageHeader
          title="Configurações"
          subtitle="Horários, dias de funcionamento, dados da marcenaria, perfil e segurança."
          badge={{ label: "M5", tone: "brand" }}
          right={<Tabs items={tabs} value={tab} onChange={(k) => setTab(k as Tab)} />}
        />
      </div>

      {msg ? (
        <div data-stagger>
          <GlassCard className="p-4">
            <div className="text-sm font-semibold text-[color:var(--muted)]">{msg}</div>
          </GlassCard>
        </div>
      ) : null}

      {tab === "salon" ? (
        <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]" data-stagger>
          <GlassCard className="p-4">
            <div className="flex items-center gap-2">
              <Badge tone="brand">
                <Building2 className="h-3.5 w-3.5" /> Marcenaria
              </Badge>
              <Badge tone="ink">{loading ? "…" : "OK"}</Badge>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Abertura</div>
                <Input value={settings.openTime} onChange={(e) => setSettingsState((p) => ({ ...p, openTime: e.target.value }))} />
              </div>
              <div>
                <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Fechamento</div>
                <Input value={settings.closeTime} onChange={(e) => setSettingsState((p) => ({ ...p, closeTime: e.target.value }))} />
              </div>

              <div className="sm:col-span-2 flex items-center gap-2">
                <input
                  id="block"
                  type="checkbox"
                  className="h-4 w-4"
                  checked={settings.blockOutsideHours}
                  onChange={(e) => setSettingsState((p) => ({ ...p, blockOutsideHours: e.target.checked }))}
                />
                <label htmlFor="block" className="text-sm font-semibold text-[color:var(--muted)]">
                  Bloquear fora do horário
                </label>
              </div>

              <div className="sm:col-span-2">
                <div className="mb-2 text-xs font-extrabold text-[color:var(--muted)]">Dias de funcionamento</div>
                <div className="flex flex-wrap gap-2">
                  {days.map((d) => {
                    const on = settings.workingDays.includes(d.v);
                    return (
                      <button
                        key={d.v}
                        type="button"
                        className={[
                          "pill px-3 py-2 text-xs font-extrabold",
                          on ? "bg-black/10" : "bg-white/35",
                        ].join(" ")}
                        onClick={() => {
                          setSettingsState((p) => {
                            const set = new Set(p.workingDays);
                            if (set.has(d.v)) set.delete(d.v);
                            else set.add(d.v);
                            return { ...p, workingDays: Array.from(set).sort((a, b) => a - b) };
                          });
                        }}
                      >
                        {d.l}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="sm:col-span-2 h-px bg-black/10" />

              <div className="sm:col-span-2">
                <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Nome</div>
                <Input value={salon.name} onChange={(e) => setSalon((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Telefone</div>
                <Input value={salon.phone} onChange={(e) => setSalon((p) => ({ ...p, phone: e.target.value }))} />
              </div>
              <div>
                <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Endereço</div>
                <Input value={salon.address} onChange={(e) => setSalon((p) => ({ ...p, address: e.target.value }))} />
              </div>

              <div className="sm:col-span-2">
                <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Logo</div>
                <div className="flex items-center gap-3">
                  <label className="pill inline-flex cursor-pointer items-center gap-2 px-3 py-2 text-xs font-extrabold">
                    <Img className="h-4 w-4" /> Selecionar
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => onPickLogo(e.target.files?.[0] || null)}
                    />
                  </label>

                  {salon.logoUrl ? (
                    <img
                      src={salon.logoUrl}
                      alt="logo"
                      className="h-12 w-12 rounded-2xl border border-[color:var(--line)] object-cover"
                    />
                  ) : (
                    <div className="grid h-12 w-12 place-items-center rounded-2xl border border-[color:var(--line)] bg-white/40 text-xs font-extrabold text-[color:var(--muted)]">
                      LOGO
                    </div>
                  )}
                </div>
              </div>

              <div className="sm:col-span-2 flex justify-end">
                <Button variant="dark" onClick={saveSalonSettings} disabled={loading}>
                  <Save className="h-4 w-4" /> Salvar
                </Button>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-4">
            <div className="font-display text-sm font-black text-[color:var(--ink)]">Dica</div>
            <div className="mt-2 text-sm font-semibold text-[color:var(--muted)]">
              Esses dados alimentam o sistema (horários, bloqueio e informações da marcenaria).
            </div>
          </GlassCard>
        </div>
      ) : null}

      {tab === "user" ? (
        <GlassCard className="p-4" data-stagger>
          <div className="flex items-center gap-2">
            <Badge tone="brand">
              <User className="h-3.5 w-3.5" /> Usuário
            </Badge>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Nome</div>
              <Input value={user.name} onChange={(e) => setUser((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Telefone</div>
              <Input value={user.phone} onChange={(e) => setUser((p) => ({ ...p, phone: e.target.value }))} />
            </div>
            <div>
              <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">E-mail</div>
              <Input value={user.email} onChange={(e) => setUser((p) => ({ ...p, email: e.target.value }))} />
            </div>

            <div className="sm:col-span-2 flex justify-end">
              <Button variant="dark" onClick={saveUser} disabled={loading}>
                <Save className="h-4 w-4" /> Salvar
              </Button>
            </div>
          </div>
        </GlassCard>
      ) : null}

      {tab === "account" ? (
        <GlassCard className="p-4" data-stagger>
          <div className="flex items-center gap-2">
            <Badge tone="wood">
              <Shield className="h-3.5 w-3.5" /> Segurança
            </Badge>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Senha atual</div>
              <Input type="password" value={pwd.currentPassword} onChange={(e) => setPwd((p) => ({ ...p, currentPassword: e.target.value }))} />
            </div>
            <div>
              <div className="mb-1 text-xs font-extrabold text-[color:var(--muted)]">Nova senha</div>
              <Input type="password" value={pwd.newPassword} onChange={(e) => setPwd((p) => ({ ...p, newPassword: e.target.value }))} />
            </div>

            <div className="sm:col-span-2 flex flex-wrap justify-between gap-2">
              <Button variant="soft" onClick={savePassword} disabled={loading}>
                <Save className="h-4 w-4" /> Trocar senha
              </Button>

              <Button variant="dark" onClick={logout}>
                <LogOut className="h-4 w-4" /> Sair
              </Button>
            </div>
          </div>
        </GlassCard>
      ) : null}
    </div>
  );
}