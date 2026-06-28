import { FinanceDashboardUseCase } from "../../../dashboard/application/finance-dashboard.use-case";
import { ListFinancialMovementsUseCase } from "../../../dashboard/application/list-financial-movements.use-case";
import { ListContasReceberUseCase } from "../../../dashboard/application/list-contas-receber.use-case";
import { ListContasPagarUseCase } from "../../../dashboard/application/list-contas-pagar.use-case";
import { collectAllPages } from "../helpers/report-pagination.helper";
import { formatCurrency, toText } from "../helpers/report-export.helper";
import {
  type ModuleReportDefinition,
  type ReportDataProvider,
  type ReportProviderContext,
} from "../types/report.types";
import { REPORT_KEYS } from "../constants/report-keys";
import {
  buildFinanceReportDefinition,
  formatDateTime,
  parseFinancePeriodFilters,
  periodFilterLabels,
} from "./helpers/finance-report.builder";

const INCOME_TYPES = ["SALE", "DEBT_PAYMENT"];
const EXPENSE_TYPES = ["EXPENSE", "PURCHASE", "REFUND"];

export class FinanceCashflowReportProvider implements ReportDataProvider {
  readonly reportKey = REPORT_KEYS.FINANCE_CASHFLOW;

  private readonly dashboardUseCase = new FinanceDashboardUseCase();
  private readonly listUseCase = new ListFinancialMovementsUseCase();

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const filters = parseFinancePeriodFilters(context.url);
    const [dashboard, items] = await Promise.all([
      this.dashboardUseCase.execute(filters),
      collectAllPages((page) =>
        this.listUseCase.execute({ ...filters, page, pageSize: 100 }),
      ),
    ]);

    const receitas = items.filter((item: any) => INCOME_TYPES.includes(item.tipo));
    const despesas = items.filter((item: any) => EXPENSE_TYPES.includes(item.tipo));

    return buildFinanceReportDefinition({
      fileBaseName: "fluxo-caixa",
      reportName: "Fluxo de Caixa",
      title: "Fluxo de Caixa",
      subtitle: "Movimentos financeiros consolidados",
      filters: periodFilterLabels(filters),
      kpis: {
        "Receitas (mes)": formatCurrency(dashboard.kpis?.receita),
        "Despesas (mes)": formatCurrency(dashboard.kpis?.despesas),
        "Fluxo de caixa": formatCurrency(dashboard.kpis?.fluxoCaixa),
        "Saldo actual": formatCurrency(dashboard.kpis?.saldoAtual),
        Movimentos: items.length,
      },
      tables: [
        {
          title: "Movimentos financeiros",
          columns: ["Data", "Tipo", "Referencia", "Valor (MZN)"],
          rows: items.map((item: any) => [
            formatDateTime(item.createdAt),
            toText(item.tipo),
            toText(item.referencia),
            formatCurrency(item.valor),
          ]),
        },
      ],
      totals: {
        Registos: items.length,
        Receitas: formatCurrency(receitas.reduce((sum, item: any) => sum + Number(item.valor ?? 0), 0)),
        Despesas: formatCurrency(despesas.reduce((sum, item: any) => sum + Number(item.valor ?? 0), 0)),
      },
    });
  }
}

export class FinanceExpensesReportProvider implements ReportDataProvider {
  readonly reportKey = REPORT_KEYS.FINANCE_EXPENSES;

  private readonly dashboardUseCase = new FinanceDashboardUseCase();
  private readonly listUseCase = new ListFinancialMovementsUseCase();

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const filters = parseFinancePeriodFilters(context.url);
    const [dashboard, items] = await Promise.all([
      this.dashboardUseCase.execute(filters),
      collectAllPages((page) =>
        this.listUseCase.execute({
          ...filters,
          types: EXPENSE_TYPES,
          page,
          pageSize: 100,
        }),
      ),
    ]);

    return buildFinanceReportDefinition({
      fileBaseName: "despesas",
      reportName: "Despesas",
      title: "Relatorio de Despesas",
      subtitle: "Movimentos de despesa, compra e reembolso",
      filters: periodFilterLabels(filters),
      kpis: {
        "Despesas (mes)": formatCurrency(dashboard.kpis?.despesas),
        "Contas a pagar": formatCurrency(dashboard.kpis?.contasPagar),
        Registos: items.length,
      },
      tables: [
        {
          title: "Despesas",
          columns: ["Data", "Tipo", "Referencia", "Valor (MZN)"],
          rows: items.map((item: any) => [
            formatDateTime(item.createdAt),
            toText(item.tipo),
            toText(item.referencia),
            formatCurrency(item.valor),
          ]),
        },
      ],
      totals: {
        Registos: items.length,
        Total: formatCurrency(items.reduce((sum, item: any) => sum + Number(item.valor ?? 0), 0)),
      },
    });
  }
}

export class FinanceAccountsReceivableReportProvider implements ReportDataProvider {
  readonly reportKey = REPORT_KEYS.FINANCE_ACCOUNTS_RECEIVABLE;

  private readonly dashboardUseCase = new FinanceDashboardUseCase();
  private readonly listUseCase = new ListContasReceberUseCase();

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const filters = parseFinancePeriodFilters(context.url);
    const [dashboard, items] = await Promise.all([
      this.dashboardUseCase.execute(filters),
      collectAllPages((page) =>
        this.listUseCase.execute({
          status: filters.status,
          clienteId: filters.clienteId,
          search: filters.search,
          page,
          pageSize: 100,
        }),
      ),
    ]);

    return buildFinanceReportDefinition({
      fileBaseName: "contas-receber",
      reportName: "Contas a Receber",
      title: "Contas a Receber",
      filters: {
        Estado: filters.status ?? "Todos",
        Cliente: filters.clienteId ?? "-",
        Pesquisa: filters.search ?? "-",
      },
      kpis: {
        "Saldo em aberto": formatCurrency(dashboard.kpis?.contasReceber),
        "Titulos pendentes": dashboard.kpis?.recebimentosPendentes ?? items.length,
        Registos: items.length,
      },
      tables: [
        {
          title: "Contas a receber",
          columns: [
            "Cliente",
            "Fatura",
            "Valor",
            "Saldo",
            "Estado",
            "Vencimento",
            "Criado em",
          ],
          rows: items.map((item: any) => [
            toText(item.clienteNome),
            toText(item.faturaNumero),
            formatCurrency(item.valor),
            formatCurrency(item.saldo),
            toText(item.status),
            formatDateTime(item.vencimento),
            formatDateTime(item.createdAt),
          ]),
        },
      ],
      totals: {
        Registos: items.length,
        "Saldo total": formatCurrency(items.reduce((sum, item: any) => sum + Number(item.saldo ?? 0), 0)),
      },
    });
  }
}

export class FinanceAccountsPayableReportProvider implements ReportDataProvider {
  readonly reportKey = REPORT_KEYS.FINANCE_ACCOUNTS_PAYABLE;

  private readonly dashboardUseCase = new FinanceDashboardUseCase();
  private readonly listUseCase = new ListContasPagarUseCase();

  async build(context: ReportProviderContext): Promise<ModuleReportDefinition> {
    const filters = parseFinancePeriodFilters(context.url);
    const [dashboard, items] = await Promise.all([
      this.dashboardUseCase.execute(filters),
      collectAllPages((page) =>
        this.listUseCase.execute({
          status: filters.status,
          fornecedorId: filters.fornecedorId,
          search: filters.search,
          page,
          pageSize: 100,
        }),
      ),
    ]);

    return buildFinanceReportDefinition({
      fileBaseName: "contas-pagar",
      reportName: "Contas a Pagar",
      title: "Contas a Pagar",
      filters: {
        Estado: filters.status ?? "Todos",
        Fornecedor: filters.fornecedorId ?? "-",
        Pesquisa: filters.search ?? "-",
      },
      kpis: {
        "Saldo em aberto": formatCurrency(dashboard.kpis?.contasPagar),
        "Titulos pendentes": dashboard.kpis?.pagamentosPendentes ?? items.length,
        Registos: items.length,
      },
      tables: [
        {
          title: "Contas a pagar",
          columns: [
            "Fornecedor",
            "Valor",
            "Saldo",
            "Estado",
            "Vencimento",
            "Criado em",
          ],
          rows: items.map((item: any) => [
            toText(item.fornecedorNome),
            formatCurrency(item.valor),
            formatCurrency(item.saldo),
            toText(item.status),
            formatDateTime(item.vencimento),
            formatDateTime(item.createdAt),
          ]),
        },
      ],
      totals: {
        Registos: items.length,
        "Saldo total": formatCurrency(items.reduce((sum, item: any) => sum + Number(item.saldo ?? 0), 0)),
      },
    });
  }
}
