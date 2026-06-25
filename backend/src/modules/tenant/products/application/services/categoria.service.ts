import { CategoriaRepository } from "../../infrastructure/repositories/categoria.repository";

type CategoriaSearchFilters = {
  query?: string;
  includeInactive?: boolean;
  page?: number;
  pageSize?: number;
};

type CategoriaPayload = {
  nome?: string;
  descricao?: string | null;
  ativo?: boolean;
};

export class CategoriaService {
  private repo = new CategoriaRepository();

  async search(filters: CategoriaSearchFilters = {}) {
    return this.repo.search(filters);
  }

  async listActive() {
    return this.repo.listActive();
  }

  async get(id: bigint) {
    const categoria = await this.repo.findById(id);
    if (!categoria) {
      throw new Error("Categoria não encontrada");
    }
    return categoria;
  }

  async create(data: CategoriaPayload, userId: string) {
    await this.ensureUniqueName(data.nome);
    return this.repo.create(
      {
        nome: data.nome?.trim(),
        descricao: data.descricao ?? null,
        ativo: data.ativo ?? true,
      },
      BigInt(userId),
    );
  }

  async update(id: bigint, data: CategoriaPayload, userId: string) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new Error("Categoria não encontrada");
    }

    if (data.nome && data.nome.trim() !== String(existing.nome)) {
      await this.ensureUniqueName(data.nome, id);
    }

    return this.repo.update(
      id,
      {
        ...(data.nome !== undefined ? { nome: data.nome.trim() } : {}),
        ...(data.descricao !== undefined ? { descricao: data.descricao } : {}),
        ...(data.ativo !== undefined ? { ativo: data.ativo } : {}),
      },
      BigInt(userId),
    );
  }

  async delete(id: bigint, userId: string) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new Error("Categoria não encontrada");
    }

    const linkedProducts = await this.repo.countLinkedProducts(id);
    if (linkedProducts > 0) {
      throw new Error("Não é possível excluir categorias com produtos vinculados");
    }

    return this.repo.softDelete(id, BigInt(userId));
  }

  private async ensureUniqueName(nome?: string, ignoreId?: bigint) {
    if (!nome?.trim()) {
      throw new Error("Nome da categoria é obrigatório");
    }

    const existing = await this.repo.findByNome(nome.trim());
    if (existing && existing.id !== ignoreId) {
      throw new Error("Já existe uma categoria com este nome");
    }
  }
}
