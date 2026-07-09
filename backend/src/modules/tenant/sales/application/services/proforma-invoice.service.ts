import { ProformaInvoiceRepository } from "../../infrastructure/repositories/proforma-invoice.repository";
import {
  buildProformaInvoiceItemApi,
  buildProformaInvoiceTotals,
} from "../helpers/proforma-invoice-calculator";
import type {
  AddProformaInvoiceItemDTO,
  CreateProformaInvoiceDTO,
  UpdateProformaInvoiceDTO,
  UpdateProformaInvoiceItemDTO,
} from "../dto/proforma-invoice.dto";

export class ProformaInvoiceService {
  private repo = new ProformaInvoiceRepository();

  /** Totais e linhas fiscais calculados em runtime (não persistidos). */
  enrichProformaInvoice<T extends { desconto?: unknown; items?: unknown[] }>(proformaInvoice: T) {
    const items = (proformaInvoice.items ?? []).map((item) =>
      buildProformaInvoiceItemApi(item as Parameters<typeof buildProformaInvoiceItemApi>[0]),
    );
    const totals = buildProformaInvoiceTotals(items, Number(proformaInvoice.desconto ?? 0));

    return {
      ...proformaInvoice,
      ...totals,
      items,
    };
  }

  create(data: CreateProformaInvoiceDTO, userId: string) {
    return this.repo.create(data, BigInt(userId));
  }

  search(filters: Parameters<ProformaInvoiceRepository["search"]>[0]) {
    return this.repo.search(filters);
  }

  get(id: string) {
    return this.repo.getById(BigInt(id));
  }

  update(id: string, data: UpdateProformaInvoiceDTO, userId: string) {
    return this.repo.update(BigInt(id), data, BigInt(userId));
  }

  addItem(proformaInvoiceId: string, data: AddProformaInvoiceItemDTO, userId: string) {
    return this.repo.addItem(BigInt(proformaInvoiceId), data, BigInt(userId));
  }

  updateItem(
    proformaInvoiceId: string,
    itemId: string,
    data: UpdateProformaInvoiceItemDTO,
    userId: string,
  ) {
    return this.repo.updateItem(
      BigInt(proformaInvoiceId),
      BigInt(itemId),
      data,
      BigInt(userId),
    );
  }

  removeItem(proformaInvoiceId: string, itemId: string, userId: string) {
    return this.repo.removeItem(BigInt(proformaInvoiceId), BigInt(itemId), BigInt(userId));
  }

  delete(id: string, userId: string) {
    return this.repo.softDelete(BigInt(id), BigInt(userId));
  }

  approve(id: string, userId: string, observacoes?: string) {
    return this.repo.mutateStatus(BigInt(id), "APROVADA", BigInt(userId), observacoes);
  }

  reject(id: string, userId: string, observacoes?: string) {
    return this.repo.mutateStatus(BigInt(id), "REJEITADA", BigInt(userId), observacoes);
  }

  expire(id: string, userId: string, observacoes?: string) {
    return this.repo.mutateStatus(BigInt(id), "EXPIRADA", BigInt(userId), observacoes);
  }

  listAudit(proformaInvoiceId: string, page?: number, pageSize?: number) {
    return this.repo.listAuditLogs(BigInt(proformaInvoiceId), page, pageSize);
  }
}
