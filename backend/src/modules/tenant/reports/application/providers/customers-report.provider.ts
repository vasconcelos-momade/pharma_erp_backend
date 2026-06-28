import { ClienteService } from "../../../clients/application/services/cliente.service";
import { formatCurrency, toText } from "../helpers/report-export.helper";
import { collectAllPages } from "../helpers/report-pagination.helper";
import { REPORT_KEYS } from "../constants/report-keys";
import {
  type ModuleReportDefinition,
  type ReportDataProvider,
  type ReportProviderContext,
} from "../types/report.types";

export class CustomersReportProvider implements ReportDataProvider {
  readonly reportKey = REPORT_KEYS.CUSTOMERS;

  private readonly clienteService = new ClienteService();

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const query = context.url.searchParams;
    const searchQuery =
      query.get("q")?.trim() || query.get("search")?.trim() || undefined;
    const tipo = query.get("tipo")?.trim() || undefined;
    const empresaId = query.get("empresaId")?.trim() || undefined;
    const comCreditoRaw = query.get("comCredito");
    const temPrescricaoRaw = query.get("temPrescricao");
    const dateFrom = query.get("dateFrom")?.trim() || undefined;
    const dateTo = query.get("dateTo")?.trim() || undefined;
    const sortBy = query.get("sortBy")?.trim() as
      | "nome"
      | "createdAt"
      | "saldoAtual"
      | undefined;
    const sortOrder = query.get("sortOrder")?.trim() as "asc" | "desc" | undefined;

    const comCredito =
      comCreditoRaw === "true" ? true : comCreditoRaw === "false" ? false : undefined;
    const temPrescricao =
      temPrescricaoRaw === "true"
        ? true
        : temPrescricaoRaw === "false"
          ? false
          : undefined;

    const items = await collectAllPages((page) =>
      this.clienteService.search({
        query: searchQuery,
        tipo,
        empresaId: empresaId ? BigInt(empresaId) : undefined,
        comCredito,
        temPrescricao,
        dateFrom,
        dateTo,
        sortBy,
        sortOrder,
        page,
        pageSize: 100,
      }),
    );

    const saldoTotal = items.reduce(
      (sum, item) => sum + Number(item.saldoAtual ?? 0),
      0,
    );

    return {
      fileBaseName: "relatorio-clientes",
      reportName: "Relatorio de Clientes",
      title: "Relatorio de Clientes",
      filters: {
        Pesquisa: searchQuery ?? "-",
        Tipo: tipo ?? "-",
        Empresa: empresaId ?? "-",
        "Com credito": comCredito == null ? "-" : comCredito ? "Sim" : "Nao",
        "Com prescricao":
          temPrescricao == null ? "-" : temPrescricao ? "Sim" : "Nao",
        De: dateFrom ?? "-",
        Ate: dateTo ?? "-",
      },
      kpis: {
        "Total de clientes": items.length,
        "Saldo total (MZN)": formatCurrency(saldoTotal),
        "Com prescricao": items.filter((item) => item.temPrescricao).length,
        Empresas: items.filter((item) => item.empresaId != null).length,
      },
      tables: [
        {
          title: "Clientes",
          columns: [
            "Nome",
            "Tipo",
            "Documento",
            "Telefone",
            "Email",
            "Saldo",
            "Prescricao",
            "Faturas",
          ],
          rows: items.map((item) => [
            toText(item.nome),
            toText(item.tipo),
            toText(item.documento ?? item.nuit),
            toText(item.telefone),
            toText(item.email),
            formatCurrency(item.saldoAtual),
            item.temPrescricao ? "Sim" : "Nao",
            toText(item._count?.faturas, "0"),
          ]),
        },
      ],
      totals: {
        Registos: items.length,
        "Saldo total (MZN)": formatCurrency(saldoTotal),
      },
      orientation: "landscape",
      pdf: {
        template: "customers/list",
        orientation: "landscape",
        pageSize: "A4",
      },
    };
  }
}
