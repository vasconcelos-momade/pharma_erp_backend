/**
 * Auditoria E2E do módulo Requisições (stock).
 * Uso: bun scripts/audit-transfers-e2e.ts
 */
import { PrismaClient } from "../src/infrastructure/prisma/tenant/generated/tenant";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:3300/api/v1";
const EMAIL = process.env.AUDIT_EMAIL ?? "dono.1780931448@demo.com";
const PASSWORD = process.env.AUDIT_PASSWORD ?? "123456";
const TENANT_DB_URL =
  process.env.DATABASE_URL_TENANT ??
  "mysql://root:root_password@mysql_central:3306/tenant_farmacia_1780931448";

type Issue = { area: string; message: string };
const issues: Issue[] = [];
const passed: string[] = [];

function fail(area: string, msg: string) {
  issues.push({ area, message: msg });
  console.error(`✗ [${area}] ${msg}`);
}
function ok(area: string, msg: string) {
  passed.push(`${area}: ${msg}`);
  console.log(`✓ [${area}] ${msg}`);
}

const prisma = new PrismaClient({ datasources: { db: { url: TENANT_DB_URL } } });

async function api(
  method: string,
  path: string,
  token: string,
  tenantId: string,
  branchId: string,
  body?: unknown,
) {
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

async function readStock(produtoId: string, loteId?: string) {
  const balance = await prisma.stockBalance.findUnique({
    where: { produtoId: BigInt(produtoId) },
  });
  const loteSum = await prisma.lote.aggregate({
    where: { produtoId: BigInt(produtoId), deletedAt: null, ativo: true },
    _sum: { quantidadeAtual: true },
  });
  let loteQty: number | null = null;
  if (loteId) {
    const lote = await prisma.lote.findUnique({
      where: { id: BigInt(loteId) },
      select: { quantidadeAtual: true },
    });
    loteQty = Number(lote?.quantidadeAtual ?? 0);
  }
  return {
    balance: Number(balance?.quantidadeTotal ?? 0),
    disponivel: Number(balance?.quantidadeDisponivel ?? 0),
    loteSum: Number(loteSum._sum.quantidadeAtual ?? 0),
    loteQty,
  };
}

async function main() {
  console.log("=== Auditoria E2E Requisições ===\n");
  const suffix = Date.now();

  const login = await fetch(`${BASE_URL}/central/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  }).then((r) => r.json());
  const token = login?.data?.token;
  const p = JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString());
  const tenantId = p.tenants[0].id;
  const branchId = p.tenants[0].branches[0].id;
  if (!token) {
    fail("auth", "Login falhou");
    return;
  }
  ok("auth", "Login OK");

  // Find product with lot
  const lote = await prisma.lote.findFirst({
    where: { deletedAt: null, ativo: true, quantidadeAtual: { gt: 5 } },
    orderBy: { id: "asc" },
    select: { id: true, produtoId: true, quantidadeAtual: true, numeroLote: true },
  });
  if (!lote) {
    fail("setup", "Nenhum lote com stock para teste");
    return;
  }
  const produtoId = lote.produtoId.toString();
  const loteId = lote.id.toString();
  const stockBefore = await readStock(produtoId, loteId);
  ok("setup", `Produto ${produtoId}, lote ${loteId} (${lote.numeroLote}), qty=${stockBefore.loteQty}`);

  // 1. Create draft
  const doc = `TRF-AUDIT-${suffix}`;
  const create = await api("POST", "/tenant/requisicoes", token, tenantId, branchId, {
    numeroDocumento: doc,
    origem: "Armazém A",
    destino: "Armazém B",
    tipo: "SAIDA",
    observacao: "audit e2e",
  });
  if (create.status !== 201) {
    fail("criar", `HTTP ${create.status}: ${JSON.stringify(create.json)}`);
    return;
  }
  const tid = String(create.json?.requisicaoId ?? create.json?.data?.requisicaoId);
  ok("criar", `Rascunho ${tid} criado`);

  // 2. Validation: origem = destino
  const badCreate = await api("POST", "/tenant/requisicoes", token, tenantId, branchId, {
    numeroDocumento: `TRF-BAD-${suffix}`,
    origem: "X",
    destino: "X",
  });
  if (badCreate.status !== 400) fail("validacao", `origem=destino devolveu HTTP ${badCreate.status}`);
  else ok("validacao", "origem=destino → 400");

  // 3. Add item with lote
  const add = await api("POST", `/tenant/requisicoes/${tid}/items`, token, tenantId, branchId, {
    produtoId,
    loteId,
    quantidade: 2,
  });
  if (add.status !== 201) fail("add-item", `HTTP ${add.status}`);
  else ok("add-item", "Item com lote adicionado");

  // 4. Re-add same line increments
  await api("POST", `/tenant/requisicoes/${tid}/items`, token, tenantId, branchId, {
    produtoId,
    loteId,
    quantidade: 1,
  });
  const detail = await api("GET", `/tenant/requisicoes/${tid}`, token, tenantId, branchId);
  const itemQty = detail.json?.itens?.[0]?.quantidade ?? detail.json?.data?.itens?.[0]?.quantidade;
  if (Number(itemQty) === 3) ok("add-item", "Re-add incrementa quantidade (2+1=3)");
  else fail("add-item", `Quantidade esperada 3, obtida ${itemQty}`);

  // 5. List RASCUNHO
  const listDraft = await api("GET", "/tenant/requisicoes?status=RASCUNHO", token, tenantId, branchId);
  const found = (listDraft.json ?? []).some?.((t: any) => String(t.id) === tid) ||
    listDraft.json?.data?.some?.((t: any) => String(t.id) === tid);
  if (listDraft.status === 200 && (found || Array.isArray(listDraft.json))) ok("listar", "GET RASCUNHO OK");
  else fail("listar", `Listagem rascunho falhou`);

  // 6. Confirm empty should fail
  const emptyDoc = `TRF-EMPTY-${suffix}`;
  const emptyCreate = await api("POST", "/tenant/requisicoes", token, tenantId, branchId, {
    numeroDocumento: emptyDoc,
    origem: "A",
    destino: "B",
  });
  const emptyId = String(emptyCreate.json?.requisicaoId ?? emptyCreate.json?.data?.requisicaoId);
  const emptyConfirm = await api(
    "POST",
    `/tenant/requisicoes/${emptyId}/confirmar`,
    token,
    tenantId,
    branchId,
    {},
  );
  if (emptyConfirm.status !== 400) fail("confirmar", `Vazia devolveu HTTP ${emptyConfirm.status}`);
  else ok("confirmar", "Requisição sem itens → 400");

  // 7. Confirm main transfer
  const confirm = await api(
    "POST",
    `/tenant/requisicoes/${tid}/confirmar`,
    token,
    tenantId,
    branchId,
    {},
  );
  if (confirm.status !== 200) {
    fail("confirmar", `HTTP ${confirm.status}: ${JSON.stringify(confirm.json)}`);
  } else {
    ok("confirmar", `Requisição ${tid} confirmada`);
  }

  // 8. Stock unchanged (documental only)
  const stockAfter = await readStock(produtoId, loteId);
  if (stockAfter.loteQty !== stockBefore.loteQty) {
    fail("stock", `Lote qty mudou: ${stockBefore.loteQty} → ${stockAfter.loteQty}`);
  } else if (stockAfter.balance !== stockBefore.balance) {
    fail("stock", `StockBalance mudou: ${stockBefore.balance} → ${stockAfter.balance}`);
  } else {
    ok("stock", "Stock físico inalterado após confirmação (documental)");
  }

  // 9. Movimentos documentais
  const movs = await prisma.estoqueMovimento.findMany({
    where: { origem: `TRANSFERENCIA:${tid}` },
    orderBy: { id: "asc" },
  });
  if (movs.length !== 1) {
    fail("movimento", `Esperado 1 movimento (tipo SAIDA), encontrados ${movs.length}`);
  } else {
    const mov = movs[0]!;
    if (mov.tipo !== "SAIDA") fail("movimento", `Tipo esperado SAIDA, obtido ${mov.tipo}`);
    else if (Number(mov.estoqueAnterior) !== Number(mov.estoqueFinal)) {
      fail("movimento", "Movimento alterou estoque (deveria ser documental)");
    } else if (!mov.observacoes?.includes("SAIDA DOCUMENTAL")) {
      fail("movimento", "Observação SAIDA DOCUMENTAL ausente");
    } else {
      ok("movimento", "1 movimento documental SAIDA com estoque inalterado");
    }
  }

  // 10. List CONFIRMADA
  const listDone = await api("GET", "/tenant/requisicoes?status=CONFIRMADA", token, tenantId, branchId);
  if (listDone.status === 200) ok("listar", "GET CONFIRMADA OK");
  else fail("listar", `CONFIRMADA HTTP ${listDone.status}`);

  // 11. Re-confirm → 400
  const reconfirm = await api(
    "POST",
    `/tenant/requisicoes/${tid}/confirmar`,
    token,
    tenantId,
    branchId,
    {},
  );
  if (reconfirm.status !== 400) fail("erro", `Re-confirmar devolveu HTTP ${reconfirm.status}`);
  else ok("erro", "Re-confirmar → 400");

  // 12. Cancel confirmed → 400
  const cancelConfirmed = await api(
    "POST",
    `/tenant/requisicoes/${tid}/cancelar`,
    token,
    tenantId,
    branchId,
    {},
  );
  if (cancelConfirmed.status !== 400) fail("cancelar", `Cancelar confirmada HTTP ${cancelConfirmed.status}`);
  else ok("cancelar", "Cancelar confirmada → 400");

  // 13. Cancel draft flow
  const cancelDoc = `TRF-CANCEL-${suffix}`;
  const cancelCreate = await api("POST", "/tenant/requisicoes", token, tenantId, branchId, {
    numeroDocumento: cancelDoc,
    origem: "C",
    destino: "D",
  });
  const cancelId = String(cancelCreate.json?.requisicaoId ?? cancelCreate.json?.data?.requisicaoId);
  await api("POST", `/tenant/requisicoes/${cancelId}/items`, token, tenantId, branchId, {
    produtoId,
    loteId,
    quantidade: 1,
  });
  const cancelRes = await api(
    "POST",
    `/tenant/requisicoes/${cancelId}/cancelar`,
    token,
    tenantId,
    branchId,
    {},
  );
  if (cancelRes.status !== 200) fail("cancelar", `Cancelar rascunho HTTP ${cancelRes.status}`);
  else ok("cancelar", "Rascunho cancelado");

  // 14. Add item to cancelled → 400
  const addCancelled = await api(
    "POST",
    `/tenant/requisicoes/${cancelId}/items`,
    token,
    tenantId,
    branchId,
    { produtoId, loteId, quantidade: 1 },
  );
  if (addCancelled.status !== 400) fail("cancelar", `Add em cancelada HTTP ${addCancelled.status}`);
  else ok("cancelar", "Add item em cancelada → 400");

  // 15. Insufficient stock
  const bigDoc = `TRF-BIG-${suffix}`;
  const bigCreate = await api("POST", "/tenant/requisicoes", token, tenantId, branchId, {
    numeroDocumento: bigDoc,
    origem: "E",
    destino: "F",
  });
  const bigId = String(bigCreate.json?.requisicaoId ?? bigCreate.json?.data?.requisicaoId);
  const hugeQty = Number(lote.quantidadeAtual) + 99999;
  await api("POST", `/tenant/requisicoes/${bigId}/items`, token, tenantId, branchId, {
    produtoId,
    loteId,
    quantidade: hugeQty,
  });
  const bigConfirm = await api(
    "POST",
    `/tenant/requisicoes/${bigId}/confirmar`,
    token,
    tenantId,
    branchId,
    {},
  );
  if (bigConfirm.status !== 400) fail("stock", `Stock insuficiente devolveu HTTP ${bigConfirm.status}`);
  else ok("stock", "Stock insuficiente na confirmação → 400");

  // 16. Detail DTO shape
  const det = await api("GET", `/tenant/requisicoes/${tid}`, token, tenantId, branchId);
  const d = det.json?.data ?? det.json;
  for (const k of ["id", "numeroDocumento", "origem", "destino", "tipo", "status", "itens"]) {
    if (!(k in (d ?? {}))) fail("dto", `Detail falta campo '${k}'`);
  }
  if (d?.status === "CONFIRMADA") ok("dto", "Detail com campos esperados");

  console.log(`\n=== RESUMO: ${passed.length} OK, ${issues.length} problemas ===`);
}

main()
  .catch((e) => {
    fail("runtime", String(e));
    console.log(`\n=== RESUMO: ${passed.length} OK, ${issues.length} problemas ===`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
