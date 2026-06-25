import type { CategoriaProdutoValue } from "../dto/produto.dto";
import { ProdutoRepository } from "../../infrastructure/repositories/produto.repository";

type ProdutoSearchFilters = {
  query?: string;
  barcode?: string;
  categoria?: CategoriaProdutoValue;
  page?: number;
  pageSize?: number;
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

  async search(filters: ProdutoSearchFilters = {}) {
    return this.repo.search(filters);
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
