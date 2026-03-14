export type UiStatusTone = "success" | "warning" | "danger" | "info" | "neutral" | "brand" | "wood";

function norm(value?: string | null) {
  return String(value || "").trim().toUpperCase();
}

function prettify(value?: string | null) {
  const raw = String(value || "").trim().replaceAll("_", " ").toLowerCase();
  if (!raw) return "—";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function orderStatusLabel(status?: string | null) {
  switch (norm(status)) {
    case "ORCAMENTO":
      return "Orçamento";
    case "PEDIDO":
      return "Pedido";
    case "EM_PRODUCAO":
      return "Em produção";
    case "PRONTO":
      return "Pronto";
    case "ENTREGUE":
      return "Entregue";
    case "CANCELADO":
      return "Cancelado";
    default:
      return prettify(status);
  }
}

export function orderStatusTone(status?: string | null): UiStatusTone {
  switch (norm(status)) {
    case "ENTREGUE":
      return "success";
    case "PRONTO":
      return "info";
    case "EM_PRODUCAO":
      return "warning";
    case "PEDIDO":
      return "brand";
    case "ORCAMENTO":
      return "neutral";
    case "CANCELADO":
      return "danger";
    default:
      return "neutral";
  }
}

export function financeStatusLabel(status?: string | null) {
  switch (norm(status)) {
    case "PAGO":
    case "PAID":
      return "Pago";
    case "ABERTO":
    case "OPEN":
      return "Aberto";
    case "VENCIDO":
    case "OVERDUE":
      return "Vencido";
    case "PARCIAL":
    case "PARTIAL":
      return "Parcial";
    case "CANCELADO":
    case "CANCELLED":
      return "Cancelado";
    default:
      return prettify(status);
  }
}

export function financeStatusTone(status?: string | null): UiStatusTone {
  switch (norm(status)) {
    case "PAGO":
    case "PAID":
      return "success";
    case "VENCIDO":
    case "OVERDUE":
      return "danger";
    case "PARCIAL":
    case "PARTIAL":
      return "info";
    case "CANCELADO":
    case "CANCELLED":
      return "neutral";
    case "ABERTO":
    case "OPEN":
      return "warning";
    default:
      return "neutral";
  }
}

export function sourceLabel(source?: string | null) {
  const s = norm(source);
  if (s.includes("RECEIV")) return "Recebível";
  if (s.includes("PAYAB")) return "Pagável";
  if (s.includes("COST")) return "Custo";
  if (s.includes("AUTO")) return "Automático";
  return "Manual";
}

export function sourceTone(source?: string | null): UiStatusTone {
  const s = norm(source);
  if (s.includes("RECEIV")) return "success";
  if (s.includes("PAYAB")) return "wood";
  if (s.includes("COST")) return "warning";
  if (s.includes("AUTO")) return "info";
  return "neutral";
}

export function reportBasisLabel(basis?: string | null) {
  return norm(basis) === "PAID" ? "Por pagamento" : "Por vencimento";
}