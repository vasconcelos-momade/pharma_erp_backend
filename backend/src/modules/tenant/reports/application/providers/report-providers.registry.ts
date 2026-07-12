import {
  AuditBusinessEventsReportProvider,
  AuditDashboardReportProvider,
  AuditFinancialReportProvider,
  AuditLogsReportProvider,
  AuditPsychotropicsReportProvider,
  AuditStockReportProvider,
  AuditTimelineReportProvider,
} from "./audit-report.provider";
import {
  ExecutiveDashboardReportProvider,
  FinanceDashboardReportProvider,
  PharmacyDashboardReportProvider,
  StockDashboardReportProvider,
} from "./dashboard-report.provider";
import {
  FinanceAccountsPayableReportProvider,
  FinanceAccountsReceivableReportProvider,
  FinanceCashflowReportProvider,
  FinanceExpensesReportProvider,
} from "./finance-report.provider";
import {
  RegulatoryLivroPsicotropicosReportProvider,
  RegulatoryLivroReceitasReportProvider,
  RegulatoryReceitasReportProvider,
  RegulatorySanitarioReportProvider,
} from "./regulatory-report.provider";
import {
  AdminAccessAuditReportProvider,
  AdminLastAccessReportProvider,
  AdminLoginHistoryReportProvider,
  AdminPermissionsMatrixReportProvider,
  AdminRolesReportProvider,
  AdminSessionsReportProvider,
  AdminUserActivityReportProvider,
  AdminUsersReportProvider,
} from "./admin-report.provider";
import { CategoriesReportProvider } from "./categories-report.provider";
import { CustomersReportProvider } from "./customers-report.provider";
import { ExpiryReportProvider } from "./expiry-report.provider";
import { FefoAuditReportProvider, FefoOverviewReportProvider } from "./fefo-report.provider";
import {
  InvoiceListReportProvider,
  SalesHistoryReportProvider,
} from "./invoice-list-report.provider";
import { InvoiceReportProvider } from "./invoice-report.provider";
import {
  InventoriesListReportProvider,
  InventoryDetailReportProvider,
} from "./inventories-report.provider";
import { LotsActiveReportProvider, LotsExpiredReportProvider } from "./lots-report.provider";
import {
  ProductsBelowMinStockReportProvider,
  ProductsByCategoryReportProvider,
  ProductsBySubstanciaReportProvider,
  ProductsBySupplierReportProvider,
  ProductsCatalogReportProvider,
  ProductsControlledReportProvider,
  ProductsExpiredReportProvider,
  ProductsNearExpiryReportProvider,
  ProductsNoStockReportProvider,
} from "./products-report.provider";
import {
  ProformaInvoiceListReportProvider,
  ProformaInvoiceReportProvider,
} from "./proforma-invoice-report.provider";
import {
  StockMovementsAjusteReportProvider,
  StockMovementsEntradaReportProvider,
  StockMovementsReportProvider,
  StockMovementsSaidaReportProvider,
} from "./stock-movements-report.provider";
import { PurchaseSuggestionsReportProvider } from "./purchase-suggestions-report.provider";
import { type ReportDataProvider } from "../types/report.types";

export const reportDataProviders: ReportDataProvider[] = [
  new ExpiryReportProvider(),
  new AuditDashboardReportProvider(),
  new AuditLogsReportProvider(),
  new AuditTimelineReportProvider(),
  new AuditBusinessEventsReportProvider(),
  new AuditPsychotropicsReportProvider(),
  new AuditStockReportProvider(),
  new AuditFinancialReportProvider(),
  new ProductsCatalogReportProvider(),
  new ProductsByCategoryReportProvider(),
  new ProductsBySupplierReportProvider(),
  new ProductsBySubstanciaReportProvider(),
  new ProductsNoStockReportProvider(),
  new ProductsBelowMinStockReportProvider(),
  new ProductsNearExpiryReportProvider(),
  new ProductsExpiredReportProvider(),
  new ProductsControlledReportProvider(),
  new CategoriesReportProvider(),
  new LotsActiveReportProvider(),
  new LotsExpiredReportProvider(),
  new FefoOverviewReportProvider(),
  new FefoAuditReportProvider(),
  new StockMovementsReportProvider(),
  new StockMovementsEntradaReportProvider(),
  new StockMovementsSaidaReportProvider(),
  new StockMovementsAjusteReportProvider(),
  new PurchaseSuggestionsReportProvider(),
  new InventoriesListReportProvider(),
  new InventoryDetailReportProvider(),
  new InvoiceReportProvider(),
  new InvoiceListReportProvider(),
  new SalesHistoryReportProvider(),
  new CustomersReportProvider(),
  new ProformaInvoiceReportProvider(),
  new ProformaInvoiceListReportProvider(),
  new ExecutiveDashboardReportProvider(),
  new FinanceDashboardReportProvider(),
  new PharmacyDashboardReportProvider(),
  new StockDashboardReportProvider(),
  new FinanceCashflowReportProvider(),
  new FinanceExpensesReportProvider(),
  new FinanceAccountsReceivableReportProvider(),
  new FinanceAccountsPayableReportProvider(),
  new RegulatoryReceitasReportProvider(),
  new RegulatoryLivroReceitasReportProvider(),
  new RegulatoryLivroPsicotropicosReportProvider(),
  new RegulatorySanitarioReportProvider(),
  new AdminUsersReportProvider(),
  new AdminSessionsReportProvider(),
  new AdminLastAccessReportProvider(),
  new AdminLoginHistoryReportProvider(),
  new AdminUserActivityReportProvider(),
  new AdminAccessAuditReportProvider(),
  new AdminPermissionsMatrixReportProvider(),
  new AdminRolesReportProvider(),
];
