import { afterEach, describe, expect, mock, test } from "bun:test";
import { TenantPrismaFactory } from "../../../../../../infrastructure/prisma/tenant-prisma.factory";
import { SearchRequisitionProdutosUseCase } from "./search-requisition-produtos.use-case";

const originalGetClient = TenantPrismaFactory.getClient;

afterEach(() => {
  (TenantPrismaFactory as any).getClient = originalGetClient;
});

describe("SearchRequisitionProdutosUseCase", () => {
  test("usa um unico OR para nome, substancia activa, barcode, lote activo e ID quando q e numerico", async () => {
    const findMany = mock(async () => [
      {
        id: 12345n,
        nome: "Paracetamol 500mg",
        barcode: "7891234567890",
        precoVenda: 120,
        estoqueMinimo: 2,
        nomeGenerico: "Paracetamol",
        dosagem: "500mg",
        forma: "Comprimido",
        apresentacao: "Caixa",
        ativo: true,
        regulacao: null,
        stockBalance: {
          quantidadeDisponivel: 9,
          quantidadeTotal: 15,
        },
        taxRule: null,
        lotes: [],
      },
    ]);

    (TenantPrismaFactory as any).getClient = mock(() => ({
      produto: { findMany },
    }));

    const result = await new SearchRequisitionProdutosUseCase().execute({
      q: "12345",
      page: 2,
      pageSize: 10,
    });

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany.mock.calls[0]?.[0]).toEqual({
      where: {
        ativo: true,
        deletedAt: null,
        OR: [
          { nomeComercial: { contains: "12345" } },
          { nomeGenerico: { contains: "12345" } },
          { barcode: { contains: "12345" } },
          {
            lotes: {
              some: {
                numeroLote: { contains: "12345" },
                ativo: true,
                deletedAt: null,
              },
            },
          },
          { id: 12345n },
        ],
      },
      select: expect.any(Object),
      orderBy: [{ nomeComercial: "asc" }, { id: "asc" }],
      skip: 10,
      take: 11,
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: 12345n,
      nome: "Paracetamol 500mg",
      estoqueAtual: 9,
      lote: null,
    });
  });

  test("filtra por categoria quando informada", async () => {
    const findMany = mock(async () => []);

    (TenantPrismaFactory as any).getClient = mock(() => ({
      produto: { findMany },
    }));

    await new SearchRequisitionProdutosUseCase().execute({
      categoriaId: 7n,
      page: 1,
      pageSize: 20,
    });

    expect(findMany.mock.calls[0]?.[0]).toMatchObject({
      where: {
        ativo: true,
        deletedAt: null,
        categoriaId: 7n,
      },
    });
  });

  test("mantem produtos com e sem lote quando nao ha pesquisa, sem exigir fornecedor, e preserva a paginacao", async () => {
    const findMany = mock(async () => [
      {
        id: 1n,
        nome: "Produto com lote",
        barcode: "111",
        precoVenda: 10,
        estoqueMinimo: 1,
        nomeGenerico: "Activa A",
        dosagem: null,
        forma: null,
        apresentacao: null,
        ativo: true,
        regulacao: null,
        stockBalance: {
          quantidadeDisponivel: 4,
          quantidadeTotal: 5,
        },
        taxRule: null,
        lotes: [
          {
            numeroLote: "L-001",
            dataValidade: new Date("2027-01-10T00:00:00.000Z"),
          },
        ],
      },
      {
        id: 2n,
        nome: "Produto sem lote",
        barcode: "222",
        precoVenda: 15,
        estoqueMinimo: 1,
        nomeGenerico: "Activa B",
        dosagem: null,
        forma: null,
        apresentacao: null,
        ativo: true,
        regulacao: null,
        stockBalance: null,
        taxRule: null,
        lotes: [],
      },
      {
        id: 3n,
        nome: "Produto extra",
        barcode: "333",
        precoVenda: 20,
        estoqueMinimo: 1,
        nomeGenerico: "Activa C",
        dosagem: null,
        forma: null,
        apresentacao: null,
        ativo: true,
        regulacao: null,
        stockBalance: {
          quantidadeDisponivel: 0,
          quantidadeTotal: 2,
        },
        taxRule: null,
        lotes: [],
      },
    ]);

    (TenantPrismaFactory as any).getClient = mock(() => ({
      produto: { findMany },
    }));

    const result = await new SearchRequisitionProdutosUseCase().execute({
      page: 1,
      pageSize: 2,
    });

    expect(findMany.mock.calls[0]?.[0]).toMatchObject({
      where: {
        ativo: true,
        deletedAt: null,
      },
      skip: 0,
      take: 3,
    });
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      id: 1n,
      estoqueAtual: 4,
      lote: "L-001",
      dataValidade: "2027-01-10T00:00:00.000Z",
    });
    expect(result.items[1]).toMatchObject({
      id: 2n,
      estoqueAtual: 0,
      lote: null,
      dataValidade: null,
    });
    expect(result.hasMore).toBe(true);
  });
});
