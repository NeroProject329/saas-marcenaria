import GlassCard from "@/components/ui/GlassCard";
import PageHeader from "@/components/layout/PageHeader";

export default function FuncionariosPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Funcionários"
        subtitle="Cadastro e custos (folha/benefícios entra com paridade no M4/M5)."
        badge={{ label: "M4/M5", tone: "warning" }}
      />
      <GlassCard className="p-4">
        <div className="text-sm font-semibold text-[color:var(--muted)]">
          Placeholder premium (M1).
        </div>
      </GlassCard>
    </div>
  );
}