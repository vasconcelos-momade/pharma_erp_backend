import { CotacaoRepository } from "../../infrastructure/repositories/cotacao.repository";
import type {
  CreateCotacaoDTO,
  UpdateCotacaoDTO,
} from "../dto/cotacao.dto";

export class CotacaoService {
  private repo = new CotacaoRepository();

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
