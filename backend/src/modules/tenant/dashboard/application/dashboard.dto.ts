import { z } from "zod";

import { DASHBOARD_PERIOD_PRESETS } from "./dashboard-period.util";

const dashboardFilterFields = {
  days: z.coerce.number().int().min(1).max(366).optional(),
  period: z.enum(DASHBOARD_PERIOD_PRESETS).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  search: z.string().trim().max(200).optional(),
  categoriaId: z.string().trim().max(64).optional(),
  produtoId: z.string().trim().max(64).optional(),
  clienteId: z.string().trim().max(64).optional(),
  fornecedorId: z.string().trim().max(64).optional(),
  estado: z.string().trim().max(64).optional(),
  metodoPagamento: z.string().trim().max(64).optional(),
  tipoMovimentacao: z.string().trim().max(64).optional(),
  sortBy: z.string().trim().max(64).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
};

export const dashboardPeriodQuerySchema = z.object(dashboardFilterFields);

export const dashboardTableQueryFields = {
  ...dashboardFilterFields,
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
};

export const financeDashboardTableQuerySchema = z.object({
  table: z.enum([
    "ultimosPagamentos",
    "ultimasReceitas",
    "ultimasDespesas",
    "contasVencidas",
    "fluxoCaixa",
    "contasReceber",
    "contasPagar",
  ]),
  ...dashboardTableQueryFields,
});

export const stockDashboardTableQuerySchema = z.object({
  table: z.enum([
    "ultimosMovimentos",
    "inventarios",
    "entradasCompra",
    "reservas",
    "incineracoes",
    "produtosCriticos",
  ]),
  ...dashboardTableQueryFields,
});

export const executiveDashboardTableQuerySchema = z.object({
  table: z.enum(["ultimasVendas", "alertasCriticos", "ultimosEventos"]),
  ...dashboardTableQueryFields,
});

export const pharmacyDashboardTableQuerySchema = z.object({
  table: z.enum([
    "produtosCriticos",
    "ultimasEntradas",
    "ultimasDispensacoes",
    "ultimosAlertas",
  ]),
  ...dashboardTableQueryFields,
});
