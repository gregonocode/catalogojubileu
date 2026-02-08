import { TrendingUp, Users, ReceiptText, ArrowUpRight } from "lucide-react";

function Card({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]">
      <div className="flex items-center justify-between">
        <div className="text-sm text-black/60">{title}</div>
        <div className="grid h-10 w-10 place-items-center rounded-2xl border border-black/10 bg-black/5">
          {icon}
        </div>
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-tight text-black">{value}</div>
      <div className="mt-2 text-sm text-black/55">{subtitle}</div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* cards principais */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card
          title="Vendas (hoje)"
          value="R$ 1.287,90"
          subtitle="+12% vs ontem"
          icon={<TrendingUp size={18} />}
        />
        <Card
          title="Clientes (hoje)"
          value="38"
          subtitle="+7 novos cadastros"
          icon={<Users size={18} />}
        />
        <Card
          title="Pedidos (hoje)"
          value="21"
          subtitle="3 pendentes"
          icon={<ReceiptText size={18} />}
        />
      </div>

      {/* gráfico placeholder */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-3xl border border-black/10 bg-white p-5 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-black">Vendas nos últimos 7 dias</div>
              <div className="text-xs text-black/55">visual (sem dados reais ainda)</div>
            </div>

            <button className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm hover:bg-black/5">
              Detalhes <ArrowUpRight size={16} />
            </button>
          </div>

          <div className="mt-4 h-[220px] rounded-2xl border border-black/10 bg-black/5 p-4">
            <div className="h-full w-full rounded-xl bg-[linear-gradient(90deg,rgba(0,0,0,0.06)_0%,rgba(0,0,0,0.02)_50%,rgba(0,0,0,0.06)_100%)] animate-pulse" />
          </div>
        </div>

        {/* resumo */}
        <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]">
          <div className="text-sm font-semibold text-black">Resumo</div>
          <div className="mt-1 text-xs text-black/55">métricas rápidas</div>

          <div className="mt-4 space-y-3">
            {[
              { k: "Ticket médio", v: "R$ 61,33" },
              { k: "Conversão", v: "3,8%" },
              { k: "Reembolso", v: "0,4%" },
            ].map((row) => (
              <div
                key={row.k}
                className="flex items-center justify-between rounded-2xl border border-black/10 bg-white px-4 py-3"
              >
                <span className="text-sm text-black/60">{row.k}</span>
                <span className="text-sm font-semibold text-black">{row.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* tabela mock */}
      <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-black">Pedidos recentes</div>
            <div className="text-xs text-black/55">visual (mock)</div>
          </div>

          <button className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm hover:bg-black/5">
            Ver todos
          </button>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-black/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/5 text-xs text-black/55">
              <tr>
                <th className="px-4 py-3">Pedido</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              {[
                { id: "#1021", cliente: "João Silva", valor: "R$ 89,90", status: "Pago" },
                { id: "#1020", cliente: "Maria Lima", valor: "R$ 49,90", status: "Pendente" },
                { id: "#1019", cliente: "Pedro Souza", valor: "R$ 129,90", status: "Pago" },
              ].map((row) => (
                <tr key={row.id} className="hover:bg-black/5">
                  <td className="px-4 py-3 font-medium text-black">{row.id}</td>
                  <td className="px-4 py-3 text-black/70">{row.cliente}</td>
                  <td className="px-4 py-3 text-black/70">{row.valor}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-1 text-xs font-semibold ring-1",
                        row.status === "Pago"
                          ? "bg-black/5 text-black ring-black/10"
                          : "bg-white text-black/60 ring-black/10"
                      )}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
