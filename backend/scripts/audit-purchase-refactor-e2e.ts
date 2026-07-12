/**
 * Auditoria E2E pós-refatoração de entrada de compras via EstoqueMovimento.
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

const issues: Issue[] = [];

function fail(area: string, message: string) {
  issues.push({ area, message });
  console.error(`✗ [${area}] ${message}`);
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

async function queryScalar(sql: string): Promise<string> {
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(sql);
  if (rows.length === 0) return "";
  const first = rows[0]!;
  const val = Object.values(first)[0];
  return val == null ? "" : String(val);
}

function near(a: number, b: number, eps = 0.01) {
  return Math.abs(a - b) <= eps;
}

async function main() {
  console.log("=== Auditoria E2E pós-refatoração (EstoqueMovimento COMPRA) ===\n");

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
  const produtoList = produtos.json?.data ?? produtos.json;
  const produto = Array.isArray(produtoList) ? produtoList[0] : produtoList?.items?.[0];
  if (!produto?.id) {
    fail("produtos", "Nenhum produto disponível");
    printSummary();
    process.exit(1);
  }
  const produtoId = String(produto.id);
  ok("produtos", `Produto teste: ${produtoId}`);

  const suffix = Date.now();
  const loteA = `AUDIT-A-${suffix}`;
  const loteB = `AUDIT-B-${suffix}`;

  const baselineTotal = Number(
    await queryScalar(`SELECT COALESCE(quantidadeTotal,0) FROM stock_balances WHERE produtoId=${produtoId}`),
  );

  const entrada1 = await api("POST", "/tenant/estoque/entrada-compra", token, tenantId, branchId, {
    produtoId,
    fornecedorId: "1",
    numeroLote: loteA,
    dataValidade: "2027-06-15",
    quantidade: 10,
    precoCompra: 25,
    precoVenda: 40,
  });
  if (entrada1.status !== 201) {
    fail("entrada-compra", `HTTP ${entrada1.status}: ${JSON.stringify(entrada1.json)}`);
  } else {
    ok("entrada-compra", "Entrada de compra registada");
  }

  const entrada2 = await api("POST", "/tenant/estoque/entrada-compra", token, tenantId, branchId, {
    produtoId,
    fornecedorId: "1",
    numeroLote: loteA,
    dataValidade: "2027-06-15",
    quantidade: 5,
    precoCompra: 26,
    precoVenda: 41,
  });
  if (entrada2.status !== 201) {
    fail("reutilizacao-lote", `Reutilização falhou HTTP ${entrada2.status}`);
  } else {
    ok("reutilizacao-lote", "Mesmo lote reutilizado (produto + numeroLote + validade)");
  }

  const novoLote = await api("POST", "/tenant/lotes", token, tenantId, branchId, {
    produtoId,
    fornecedorId: "1",
    numeroLote: loteB,
    dataValidade: "2028-12-31",
    quantidadeInicial: 3,
    precoCompra: 20,
    precoVenda: 35,
  });
  if (novoLote.status !== 201) {
    fail("novo-lote", `POST /tenant/lotes falhou HTTP ${novoLote.status}`);
  } else {
    ok("novo-lote", "Novo lote criado com movimento COMPRA");
  }

  const afterTotal = Number(
    await queryScalar(`SELECT COALESCE(quantidadeTotal,0) FROM stock_balances WHERE produtoId=${produtoId}`),
  );
  if (!near(afterTotal, baselineTotal + 18)) {
    fail("stock-balance", `StockBalance=${afterTotal}, esperado ${baselineTotal + 18}`);
  } else {
    ok("stock-balance", `StockBalance actualizado: ${afterTotal}`);
  }

  const movCompra = Number(
    await queryScalar(`
      SELECT COUNT(*) FROM estoque_movimentos
      WHERE produtoId=${produtoId} AND tipo='COMPRA' AND origem='COMPRA'
        AND createdAt > DATE_SUB(NOW(), INTERVAL 5 MINUTE)
    `),
  );
  if (movCompra < 3) {
    fail("movimento", `Esperados >=3 movimentos COMPRA, obtidos ${movCompra}`);
  } else {
    ok("movimento", `${movCompra} movimento(s) COMPRA gerado(s)`);
  }

  const suggestions = await api("GET", "/tenant/compras/sugestoes", token, tenantId, branchId);
  if (suggestions.status !== 200) {
    fail("sugestoes", `GET sugestões HTTP ${suggestions.status}`);
  } else {
    ok("sugestoes", "Sugestões de compra independentes OK");
  }

  const drift = Number(
    await queryScalar(`
      SELECT COUNT(*) AS c FROM (
        SELECT p.id
        FROM produtos p
        LEFT JOIN stock_balances sb ON sb.produtoId = p.id
        LEFT JOIN (
          SELECT produtoId, SUM(quantidadeTotal) AS s
          FROM lote_stock_balances lsb
          JOIN lotes l ON l.id = lsb.loteId
          WHERE l.deletedAt IS NULL AND l.ativo=1
          GROUP BY produtoId
        ) x ON x.produtoId = p.id
        WHERE COALESCE(sb.quantidadeTotal,0) <> COALESCE(x.s,0)
      ) t
    `),
  );
  if (drift > 0) {
    fail("drift", `${drift} produto(s) com StockBalance ≠ soma lotes`);
  } else {
    ok("drift", "Sem drift StockBalance vs lotes");
  }

  printSummary();
  process.exit(issues.length > 0 ? 1 : 0);
}

function printSummary() {
  console.log("\n=== RESUMO ===");
  console.log(`Problemas: ${issues.length}`);
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
