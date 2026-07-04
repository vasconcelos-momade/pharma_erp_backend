import { ProdutoRepository } from "../../infrastructure/repositories/produto.repository";
import { CategoriaRepository } from "../../infrastructure/repositories/categoria.repository";

type ProdutoSearchFilters = {
  query?: string;
  barcode?: string;
  categoriaId?: string;
  fornecedorId?: string;
  tipoDispensacao?: string;
  ativo?: boolean;
  includeInactive?: boolean;
  sortBy?: "nome" | "estoqueAtual" | "createdAt";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export class ProdutoService {
  private repo = new ProdutoRepository();
  private categoriaRepo = new CategoriaRepository();

  async create(data: any, userId: string) {
    const nomeComercial = data.nomeComercial ?? data.nome;
    if (!nomeComercial || String(nomeComercial).trim().length === 0) {
      throw new Error("Nome comercial do produto é obrigatório");
    }

    const payload = await this.resolveCategoriaPayload(
      this.normalizePayload({ ...data, nomeComercial }),
      true,
    );

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
    const fornecedorId =
      filters.fornecedorId && filters.fornecedorId.trim().length > 0
        ? BigInt(filters.fornecedorId)
        : undefined;

    return this.repo.search({
      query: filters.query,
      barcode: filters.barcode,
      categoriaId,
      fornecedorId,
      tipoDispensacao: filters.tipoDispensacao,
      ativo: filters.ativo,
      includeInactive: filters.includeInactive,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
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

  async getDashboard() {
    return this.repo.getDashboard();
  }

  async listSuppliers(id: bigint) {
    const produto = await this.repo.findById(id);
    if (!produto) {
      throw new Error("Produto não encontrado");
    }
    return this.repo.listSuppliers(id);
  }

  async listClassificationHistory(id: bigint, page?: number, pageSize?: number) {
    const produto = await this.repo.findById(id);
    if (!produto) {
      throw new Error("Produto não encontrado");
    }
    return this.repo.listClassificationHistory(id, page, pageSize);
  }

  async listAuditLogs(id: bigint, page?: number, pageSize?: number) {
    const produto = await this.repo.findById(id);
    if (!produto) {
      throw new Error("Produto não encontrado");
    }
    return this.repo.listAuditLogs(id, page, pageSize);
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
    if (payload.nomeComercial === undefined && payload.nome !== undefined) {
      payload.nomeComercial = payload.nome;
    }
    delete payload.nome;
    if (payload.nomeGenerico === undefined && payload.substanciaActiva !== undefined) {
      payload.nomeGenerico = payload.substanciaActiva;
    }
    delete payload.substanciaActiva;
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
    const rawId = filters.categoriaId ?? (filters as { categoria?: string }).categoria;
    if (rawId) {
      const categoria = await this.categoriaRepo.findById(BigInt(rawId));
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
