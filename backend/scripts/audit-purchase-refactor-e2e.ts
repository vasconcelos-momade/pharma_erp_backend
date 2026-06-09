/**
 * Auditoria final pós-refatoração de recebimento de compras.
 * Uso: bun scripts/audit-purchase-refactor-e2e.ts
 */
const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:3300/api/v1";
const EMAIL = process.env.AUDIT_EMAIL ?? "dono.1780931448@demo.com";
const PASSWORD = process.env.AUDIT_PASSWORD ?? "123456";
import { PrismaClient } from "../src/infrastructure/prisma/tenant/generated/tenant";

const TENANT_DB_URL =
  process.env.DATABASE_URL_TENANT ??
  "mysql://root:root_password@mysql_central:3306/tenant_farmacia_1780931448";

type Issue = { area: string; message: string };
type Risk = { area: string; message: string };

const issues: Issue[] = [];
const risks: Risk[] = [];

function fail(area: string, message: string) {
  issues.push({ area, message });
  console.error(`✗ [${area}] ${message}`);
}

function warn(area: string, message: string) {
  risks.push({ area, message });
  console.warn(`⚠ [${area}] ${message}`);
}

function ok(area: string, message: string) {
  console.log(`✓ [${area}] ${message}`);
}

async function api(
  method: string,
  path: string,
  token: string,
  tenantId: string,
  branchId: string,
  body?: unknown,
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "x-tenant-id": tenantId,
      "x-branch-id": branchId,
      "Content-Type": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

const prisma = new PrismaClient({
  datasources: { db: { url: TENANT_DB_URL } },
});

async function queryRows<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  return prisma.$queryRawUnsafe<T[]>(sql);
}

async function queryScalar(sql: string): Promise<string> {
  const rows = await queryRows<Record<string, unknown>>(sql);
  if (rows.length === 0) return "";
  const first = rows[0]!;
  const val = Object.values(first)[0];
  return val == null ? "" : String(val);
}

function near(a: number, b: number, eps = 0.01) {
  return Math.abs(a - b) <= eps;
}

async function main() {
  console.log("=== Auditoria E2E pós-refatoração ===\n");

  const login = await fetch(`${BASE_URL}/central/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const loginJson = await login.json();
  const token = loginJson?.data?.token;
  const tenantId = loginJson?.data?.token
    ? JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString()).tenants?.[0]?.id
    : null;
  const branchId = loginJson?.data?.token
    ? JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString()).tenants?.[0]?.branches?.[0]?.id
    : null;

  if (!token || !tenantId || !branchId) {
    fail("auth", "Login central falhou");
    printSummary();
    process.exit(1);
  }
  ok("auth", "Login central OK");

  const produtos = await api("GET", "/tenant/produtos?limit=5", token, tenantId, branchId);
  if (produtos.status !== 200) {
    fail("produtos", `Listagem falhou HTTP ${produtos.status}`);
    printSummary();
    process.exit(1);
  }

  const produtoList = produtos.json?.data ?? produtos.json;
  const produto = Array.isArray(produtoList) ? produtoList[0] : produtoList?.items?.[0];
  if (!produto?.id) {
    fail("produtos", "Nenhum produto disponível para teste");
    printSummary();
    process.exit(1);
  }
  const produtoId = String(produto.id);
  ok("produtos", `Produto teste: ${produtoId} (${produto.nome ?? "?"})`);

  const baseline = await readStockState(produtoId);
  ok("baseline", `Stock inicial produto ${produtoId}: lotes=${baseline.loteSum} balance=${baseline.balanceTotal} cache=${baseline.cache}`);

  const suffix = Date.now();
  const loteReuse = `AUDIT-REUSE-${suffix}`;
  const loteNew = `AUDIT-NEW-${suffix}`;
  const validade1 = "2027-06-15";
  const validade2 = "2028-12-31";

  // --- Fluxo 1: compra pendente → confirmação (novo lote) ---
  const doc1 = `AUDIT-DOC1-${suffix}`;
  const create1 = await api("POST", "/tenant/compras", token, tenantId, branchId, {
    fornecedorId: "1",
    numeroDocumento: doc1,
  });
  if (create1.status !== 201 || !create1.json?.data?.id && !create1.json?.id) {
    fail("compra-pendente", `Criar compra pendente falhou: HTTP ${create1.status}`);
  } else {
    const compra1Id = String(create1.json?.data?.id ?? create1.json?.id);
    const dtoKeys = Object.keys(create1.json?.data ?? create1.json ?? {});
    for (const k of ["id", "numeroDocumento", "fornecedorId", "status", "total"]) {
      if (!dtoKeys.includes(k)) fail("dto", `createPendingPurchase falta campo '${k}'`);
    }
    if (create1.json?.data?.status !== "PENDENTE" && create1.json?.status !== "PENDENTE") {
      fail("compra-pendente", "Status inicial não é PENDENTE");
    } else {
      ok("compra-pendente", `Compra ${compra1Id} criada`);
    }

    const add1 = await api("POST", `/tenant/compras/${compra1Id}/items`, token, tenantId, branchId, {
      produtoId,
      numeroLote: loteNew,
      dataValidade: validade2,
      quantidade: 10,
      precoCompra: 25,
      precoVenda: 40,
    });
    if (add1.status !== 201) {
      fail("add-item", `Adicionar item falhou HTTP ${add1.status}`);
    } else {
      const detail = add1.json?.data ?? add1.json;
      const item = detail?.items?.[0];
      if (!item?.id) fail("dto", "addPurchaseItem não retorna items[].id");
      else {
        for (const k of ["produtoId", "numeroLote", "dataValidade", "quantidade", "precoCompra", "precoVenda", "subtotal"]) {
          if (!(k in item)) fail("dto", `item detail falta '${k}'`);
        }
        if (item.dataValidade && !item.dataValidade.startsWith("2028-12-31")) {
          fail("normalize-expiry", `dataValidade item não normalizada: ${item.dataValidade}`);
        } else {
          ok("normalize-expiry", "dataValidade normalizada no item da compra");
        }
      }
      ok("add-item", "Item adicionado à compra pendente");
    }

    const confirm1 = await api("POST", `/tenant/compras/${compra1Id}/confirmar`, token, tenantId, branchId, {});
    if (confirm1.status !== 200) {
      fail("confirmar", `Confirmação falhou HTTP ${confirm1.status}: ${JSON.stringify(confirm1.json)}`);
    } else {
      ok("confirmar", `Compra ${compra1Id} confirmada (novo lote)`);
    }

    const after1 = await readStockState(produtoId, loteNew, validade2);
    if (!after1.lote) fail("novo-lote", `Lote ${loteNew} não criado`);
    else {
      if (!near(Number(after1.lote.qty), 10)) {
        fail("novo-lote", `quantidadeAtual=${after1.lote.qty} esperado 10 no lote novo`);
      } else ok("novo-lote", `Lote criado id=${after1.lote.id} qty=${after1.lote.qty}`);
    }

    if (!near(after1.loteSum, baseline.loteSum + 10)) {
      fail("novo-lote", `stock produto=${after1.loteSum} esperado ${baseline.loteSum + 10}`);
    }

    const mov1 = await countMovimentos(produtoId, "ENTRADA", "COMPRA_FORNECEDOR");
    if (mov1 < 1) fail("movimento", "EstoqueMovimento ENTRADA/COMPRA_FORNECEDOR não gerado");
    else ok("movimento", `EstoqueMovimento gerado (${mov1} recente(s))`);

  validateStockConsistency(produtoId, after1, "após compra 1");
  }

  // --- Fluxo 2: reutilização de lote (múltiplos recebimentos) ---
  const doc2 = `AUDIT-DOC2-${suffix}`;
  const create2 = await api("POST", "/tenant/compras", token, tenantId, branchId, {
    fornecedorId: "1",
    numeroDocumento: doc2,
  });
  const compra2Id = String(create2.json?.data?.id ?? create2.json?.id);

  await api("POST", `/tenant/compras/${compra2Id}/items`, token, tenantId, branchId, {
    produtoId,
    numeroLote: loteNew,
    dataValidade: validade2,
    quantidade: 5,
    precoCompra: 26,
    precoVenda: 41,
  });
  const loteIdBefore = (await readStockState(produtoId, loteNew, validade2)).lote?.id;
  await api("POST", `/tenant/compras/${compra2Id}/confirmar`, token, tenantId, branchId, {});
  const after2 = await readStockState(produtoId, loteNew, validade2);

  if (!after2.lote || after2.lote.id !== loteIdBefore) {
    fail("reutilizacao-lote", `Lote reutilizado esperado id=${loteIdBefore}, obtido=${after2.lote?.id}`);
  } else if (!near(Number(after2.lote.qty), 15)) {
    fail("reutilizacao-lote", `qty lote=${after2.lote.qty} esperado 15 (10+5)`);
  } else {
    ok("reutilizacao-lote", `Mesmo lote id=${after2.lote.id}, qty=15 acumulado`);
  }
  if (!near(after2.loteSum, baseline.loteSum + 15)) {
    fail("reutilizacao-lote", `stock produto=${after2.loteSum} esperado ${baseline.loteSum + 15}`);
  }
  validateStockConsistency(produtoId, after2, "após reutilização");

  // --- Fluxo 3: segundo lote (FEFO ordering) via receive direct ---
  const doc3 = `AUDIT-DOC3-${suffix}`;
  const receive = await api("POST", "/tenant/stock/receive", token, tenantId, branchId, {
    fornecedorId: "1",
    numeroDocumento: doc3,
    items: [
      {
        produtoId,
        numeroLote: loteReuse,
        dataValidade: validade1,
        quantidade: 3,
        precoCompra: 20,
        precoVenda: 35,
      },
    ],
  });
  if (receive.status !== 200 && receive.status !== 201) {
    fail("receive-direct", `POST /tenant/stock/receive falhou HTTP ${receive.status}`);
  } else {
    ok("receive-direct", "Endpoint receive direct OK (DTO compatível)");
  }

  const after3 = await readStockState(produtoId);
  validateStockConsistency(produtoId, after3, "após receive direct");

  const fefoRows = await queryRows<{
    id: bigint;
    numeroLote: string;
    dataValidade: Date;
    quantidadeAtual: unknown;
  }>(`
    SELECT id, numeroLote, dataValidade, quantidadeAtual
    FROM lotes
    WHERE produtoId=${produtoId} AND deletedAt IS NULL AND ativo=1
      AND numeroLote IN ('${loteReuse}','${loteNew}')
    ORDER BY dataValidade ASC
  `);
  if (fefoRows.length < 2) {
    warn("fefo", "Menos de 2 lotes para validar ordenação FEFO");
  } else if (fefoRows[0]!.numeroLote === loteReuse) {
    ok("fefo", `Ordenação ASC por dataValidade: ${loteReuse} antes de ${loteNew}`);
  } else {
    fail("fefo", `Ordem FEFO inesperada: ${fefoRows.map((r) => r.numeroLote).join(", ")}`);
  }

  // --- Inventário: abrir + iniciar contagem (smoke) ---
  const invOpen = await api("POST", "/tenant/inventarios", token, tenantId, branchId, {
    observacoes: `Audit ${suffix}`,
  });
  if (invOpen.status !== 201 && invOpen.status !== 200) {
    fail("inventario", `Abrir inventário falhou HTTP ${invOpen.status}`);
  } else {
    const invId = String(invOpen.json?.data?.id ?? invOpen.json?.id);
    ok("inventario", `Inventário ${invId} aberto`);

    const invStart = await api(
      "POST",
      `/tenant/inventarios/${invId}/iniciar-contagem`,
      token,
      tenantId,
      branchId,
      {},
    );
    if (invStart.status !== 200) {
      fail("inventario", `Iniciar contagem falhou HTTP ${invStart.status}`);
    } else {
      ok("inventario", "Iniciar contagem OK (compatível)");
    }

    await api("POST", `/tenant/inventarios/${invId}/cancelar`, token, tenantId, branchId, {});
  }

  // --- Compra vazia → 400 ---
  const emptyDoc = `AUDIT-EMPTY-${suffix}`;
  const emptyCreate = await api("POST", "/tenant/compras", token, tenantId, branchId, {
    fornecedorId: "1",
    numeroDocumento: emptyDoc,
  });
  const emptyId = String(emptyCreate.json?.data?.id ?? emptyCreate.json?.id);
  const emptyConfirm = await api(
    "POST",
    `/tenant/compras/${emptyId}/confirmar`,
    token,
    tenantId,
    branchId,
    {},
  );
  if (emptyConfirm.status !== 400) {
    fail("validacao", `Compra sem itens devolveu HTTP ${emptyConfirm.status} (esperado 400)`);
  } else {
    ok("validacao", "Compra sem itens → HTTP 400");
  }

  // --- List/detail endpoints ---
  const list = await api("GET", "/tenant/compras?status=RECEBIDA", token, tenantId, branchId);
  if (list.status !== 200) fail("endpoints", `GET /tenant/compras HTTP ${list.status}`);
  else ok("endpoints", "GET /tenant/compras OK");

  const suppliers = await api("GET", "/tenant/fornecedores", token, tenantId, branchId);
  if (suppliers.status !== 200) fail("endpoints", `GET /tenant/fornecedores HTTP ${suppliers.status}`);
  else ok("endpoints", "GET /tenant/fornecedores OK");

  // --- estoqueAnterior coerente no último movimento ---
  const lastMovRows = await queryRows<{
    estoqueAnterior: unknown;
    estoqueFinal: unknown;
    quantidade: unknown;
  }>(`
    SELECT estoqueAnterior, estoqueFinal, quantidade
    FROM estoque_movimentos
    WHERE produtoId=${produtoId} AND origem='COMPRA_FORNECEDOR'
    ORDER BY id DESC LIMIT 1
  `);
  if (lastMovRows[0]) {
    const ant = Number(lastMovRows[0].estoqueAnterior);
    const fin = Number(lastMovRows[0].estoqueFinal);
    const qtd = Number(lastMovRows[0].quantidade);
    if (!near(fin, ant + qtd)) {
      fail("estoqueAnterior", `último movimento: anterior=${ant} + qtd=${qtd} ≠ final=${fin}`);
    } else {
      ok("estoqueAnterior", `Movimento coerente: ${ant} + ${qtd} = ${fin}`);
    }
  }

  // --- Drift global ---
  const drift = await queryScalar(`
    SELECT COUNT(*) AS c FROM (
      SELECT p.id
      FROM produtos p
      LEFT JOIN stock_balances sb ON sb.produtoId = p.id
      LEFT JOIN (
        SELECT produtoId, SUM(quantidadeAtual) AS s
        FROM lotes WHERE deletedAt IS NULL AND ativo=1 GROUP BY produtoId
      ) l ON l.produtoId = p.id
      WHERE COALESCE(sb.quantidadeTotal,0) <> COALESCE(l.s,0)
    ) x
  `);
  if (Number(drift) > 0) {
    fail("drift", `${drift} produto(s) com StockBalance ≠ soma lotes`);
  } else {
    ok("drift", "Sem drift StockBalance vs lotes");
  }

  printSummary();
  process.exit(issues.length > 0 ? 1 : 0);
}

async function readStockState(
  produtoId: string,
  numeroLote?: string,
  dataValidade?: string,
) {
  const loteSum = Number(
    await queryScalar(`
    SELECT COALESCE(SUM(quantidadeAtual),0) AS v
    FROM lotes WHERE produtoId=${produtoId} AND deletedAt IS NULL AND ativo=1
  `),
  );
  const balanceRows = await queryRows<{ quantidadeTotal: unknown; quantidadeDisponivel: unknown }>(`
    SELECT quantidadeTotal, quantidadeDisponivel
    FROM stock_balances WHERE produtoId=${produtoId}
  `);
  const cache = Number(
    await queryScalar(`SELECT COALESCE(estoqueAtual,0) AS v FROM produtos WHERE id=${produtoId}`),
  );

  let lote: { id: string; qty: string } | null = null;
  if (numeroLote && dataValidade) {
    const loteRows = await queryRows<{ id: bigint; quantidadeAtual: unknown }>(`
      SELECT id, quantidadeAtual FROM lotes
      WHERE produtoId=${produtoId} AND numeroLote='${numeroLote}'
        AND DATE(dataValidade)='${dataValidade}' AND deletedAt IS NULL
      LIMIT 1
    `);
    if (loteRows[0]) {
      lote = {
        id: String(loteRows[0].id),
        qty: String(loteRows[0].quantidadeAtual),
      };
    }
  }

  const balance = balanceRows[0];
  return {
    loteSum,
    balanceTotal: Number(balance?.quantidadeTotal ?? 0),
    balanceDisp: Number(balance?.quantidadeDisponivel ?? 0),
    cache,
    lote,
  };
}

function validateStockConsistency(
  produtoId: string,
  state: Awaited<ReturnType<typeof readStockState>>,
  label: string,
) {
  if (!near(state.loteSum, state.balanceTotal)) {
    fail("consistencia", `${label}: soma lotes=${state.loteSum} ≠ StockBalance=${state.balanceTotal}`);
  } else if (!near(state.loteSum, state.cache)) {
    fail("consistencia", `${label}: soma lotes=${state.loteSum} ≠ estoqueAtual=${state.cache}`);
  } else {
    ok("consistencia", `${label}: lotes=balance=cache=${state.loteSum}`);
  }
}

async function countMovimentos(
  produtoId: string,
  tipo: string,
  origem: string,
  loteId?: string,
) {
  const filter = loteId ? `AND loteId=${loteId}` : "";
  const row = await queryScalar(`
    SELECT COUNT(*) AS c FROM estoque_movimentos
    WHERE produtoId=${produtoId} AND tipo='${tipo}' AND origem='${origem}' ${filter}
      AND createdAt > DATE_SUB(NOW(), INTERVAL 5 MINUTE)
  `);
  return Number(row || 0);
}

function printSummary() {
  console.log("\n=== RESUMO ===");
  console.log(`Problemas: ${issues.length}`);
  console.log(`Riscos: ${risks.length}`);
}

main()
  .catch((e) => {
    fail("runtime", String(e));
    printSummary();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
