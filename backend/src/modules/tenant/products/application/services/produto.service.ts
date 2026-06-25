import { ProdutoRepository } from "../../infrastructure/repositories/produto.repository";
import { CategoriaRepository } from "../../infrastructure/repositories/categoria.repository";

type ProdutoSearchFilters = {
  query?: string;
  barcode?: string;
  categoriaId?: string;
  includeInactive?: boolean;
  page?: number;
  pageSize?: number;
};

export class ProdutoService {
  private repo = new ProdutoRepository();
  private categoriaRepo = new CategoriaRepository();

  async create(data: any, userId: string) {
    if (!data.nome) {
      throw new Error("Nome do produto é obrigatório");
    }

    const payload = await this.resolveCategoriaPayload(this.normalizePayload(data), true);

    if (payload.barcode) {
      const existing = await this.repo.findByBarcode(String(payload.barcode));
      if (existing) {
        throw new Error("Já existe um produto com este código de barras");
      }
    }

    return this.repo.create(payload, BigInt(userId));
  }

  async search(filters: ProdutoSearchFilters = {}) {
    const categoriaId = await this.resolveSearchCategoriaId(filters);
    return this.repo.search({
      query: filters.query,
      barcode: filters.barcode,
      categoriaId,
      includeInactive: filters.includeInactive,
      page: filters.page,
      pageSize: filters.pageSize,
    });
  }

  async get(id: bigint) {
    const produto = await this.repo.findById(id);
    if (!produto) {
      throw new Error("Produto não encontrado");
    }
    return produto;
  }

  async update(id: bigint, data: any, userId: string) {
    const payload = await this.resolveCategoriaPayload(this.normalizePayload(data), false);
    return this.repo.update(id, payload, BigInt(userId));
  }

  async delete(id: bigint, userId: string) {
    return this.repo.softDelete(id, BigInt(userId));
  }

  private normalizePayload(data: Record<string, unknown>) {
    const payload = { ...data };
    if (payload.ativo === undefined && payload.activo !== undefined) {
      payload.ativo = payload.activo;
    }
    delete payload.activo;
    return payload;
  }

  private async resolveCategoriaPayload(
    data: Record<string, unknown>,
    requireCategoria: boolean,
  ) {
    const payload = { ...data };
    const categoriaId = await this.resolveCategoriaIdFromPayload(payload, requireCategoria);

    delete payload.categoria;
    if (categoriaId) {
      payload.categoriaId = categoriaId.toString();
    }

    return payload;
  }

  private async resolveSearchCategoriaId(filters: ProdutoSearchFilters) {
    if (filters.categoriaId) {
      const categoria = await this.categoriaRepo.findById(BigInt(filters.categoriaId));
      if (!categoria) {
        throw new Error("Categoria não encontrada");
      }
      return categoria.id as bigint;
    }
    return undefined;
  }

  private async resolveCategoriaIdFromPayload(
    payload: Record<string, unknown>,
    requireCategoria: boolean,
  ): Promise<bigint | undefined> {
    const categoriaIdValue = payload.categoriaId;
    if (typeof categoriaIdValue === "string" && categoriaIdValue.trim().length > 0) {
      const categoria = await this.categoriaRepo.findById(BigInt(categoriaIdValue));
      if (!categoria) {
        throw new Error("Categoria não encontrada");
      }
      if (!categoria.ativo) {
        throw new Error("Categoria inativa não pode ser associada ao produto");
      }
      return categoria.id as bigint;
    }

    if (!requireCategoria) {
      return undefined;
    }

    const fallback = await this.categoriaRepo.findDefaultCategory();
    if (!fallback) {
      throw new Error("Nenhuma categoria activa disponível para associar ao produto");
    }
    return fallback.id as bigint;
  }
}
