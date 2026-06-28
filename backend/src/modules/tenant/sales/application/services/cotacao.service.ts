import { CotacaoRepository } from "../../infrastructure/repositories/cotacao.repository";
import {
  buildCotacaoItemApi,
  buildCotacaoTotals,
} from "../helpers/cotacao-calculator";
import type {
  CreateCotacaoDTO,
  UpdateCotacaoDTO,
} from "../dto/cotacao.dto";

export class CotacaoService {
  private repo = new CotacaoRepository();

  /** Totais e linhas fiscais calculados em runtime (não persistidos). */
  enrichCotacao<T extends { desconto?: unknown; items?: unknown[] }>(cotacao: T) {
    const items = (cotacao.items ?? []).map((item) =>
      buildCotacaoItemApi(item as Parameters<typeof buildCotacaoItemApi>[0]),
    );
    const totals = buildCotacaoTotals(items, Number(cotacao.desconto ?? 0));

    return {
      ...cotacao,
      ...totals,
      items,
    };
  }

  create(data: CreateCotacaoDTO, userId: string) {
    return this.repo.create(data, BigInt(userId));
  }

  search(filters: Parameters<CotacaoRepository["search"]>[0]) {
    return this.repo.search(filters);
  }

  get(id: string) {
    return this.repo.getById(BigInt(id));
  }

  update(id: string, data: UpdateCotacaoDTO, userId: string) {
    return this.repo.update(BigInt(id), data, BigInt(userId));
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

  listAudit(cotacaoId: string, page?: number, pageSize?: number) {
    return this.repo.listAuditLogs(BigInt(cotacaoId), page, pageSize);
  }
}
