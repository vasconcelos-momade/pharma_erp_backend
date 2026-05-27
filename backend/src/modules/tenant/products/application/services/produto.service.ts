import { ProdutoRepository } from "../../infrastructure/repositories/produto.repository";

type ProdutoListFilters = {
  requiresManualReview?: boolean;
};

export class ProdutoService {
  private repo = new ProdutoRepository();

  async create(data: any, userId: string) {
    // Validação básica
    if (!data.nome) {
      throw new Error("Nome do produto é obrigatório");
    }

    // Verificar se já existe barcode duplicado se fornecido
    if (data.barcode) {
      const existing = await this.repo.findByBarcode(data.barcode);
      if (existing) {
        throw new Error("Já existe um produto com este código de barras");
      }
    }

    return this.repo.create(data, BigInt(userId));
  }

  async list(filters: ProdutoListFilters = {}) {
    return (this.repo as any).findAll(filters);
  }

  async get(id: bigint) {
    const produto = await this.repo.findById(id);
    if (!produto) {
      throw new Error("Produto não encontrado");
    }
    return produto;
  }

  async update(id: bigint, data: any, userId: string) {
    return this.repo.update(id, data, BigInt(userId));
  }

  async delete(id: bigint, userId: string) {
    return this.repo.softDelete(id, BigInt(userId));
  }
}
