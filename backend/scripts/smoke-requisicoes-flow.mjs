/** Fluxo completo: ENTRADA/SAIDA/COMPRA — aprovar, rejeitar, cancelar, stock */
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3300/api/v1";
const EMAIL = process.env.AUDIT_EMAIL ?? "dono.1781095907@demo.com";
const PASS = process.env.AUDIT_PASSWORD ?? "123456";

const passed = [];
const failed = [];
const ok = (m) => { passed.push(m); console.log(`PASS ${m}`); };
const bad = (m, d) => { failed.push(m); console.log(`FAIL ${m}`, JSON.stringify(d).slice(0, 400)); };

function unwrap(p) {
  if (p?.success === true && p?.data !== undefined) return p.data;
  return p;
}

async function req(method, path, token, tenantId, branchId, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "x-tenant-id": tenantId,
      "x-branch-id": branchId,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

const loginRes = await fetch(`${BASE}/central/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASS }),
}).then((r) => r.json());
const token = loginRes?.data?.token;
if (!token) { bad("login", loginRes); process.exit(1); }
const p = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
const tenantId = p.tenants[0].id;
const branchId = p.tenants[0].branches[0].id;
ok("login");

const suffix = Date.now();
const suppliers = unwrap((await req("GET", "/tenant/fornecedores", token, tenantId, branchId)).data);
const fornecedorId = suppliers[0].id;

// Find product with lot
const prodRes = await req("GET", "/tenant/produtos?limit=5", token, tenantId, branchId);
const produtos = unwrap(prodRes.data);
const produtoId = produtos?.items?.[0]?.id ?? produtos?.[0]?.id;
if (!produtoId) { bad("produto", prodRes); process.exit(1); }
ok(`produto ${produtoId}`);

const lotesRes = await req("GET", `/tenant/produtos/${produtoId}/lotes`, token, tenantId, branchId);
const lotes = unwrap(lotesRes.data);
const loteId = lotes?.[0]?.id;
if (loteId) ok(`lote ${loteId} (FEFO list)`);
else bad("lotes", lotesRes);

// ENTRADA flow
const ent = await req("POST", "/tenant/requisicoes", token, tenantId, branchId, {
  numeroDocumento: `ENT-FLOW-${suffix}`,
  origem: "Fornecedor Teste",
  fornecedorId,
  tipo: "ENTRADA",
});
const entId = unwrap(ent.data)?.requisicaoId;
if (ent.status !== 201 || !entId) bad("create ENTRADA", ent);
else ok("create ENTRADA");

if (loteId) {
  const addEnt = await req("POST", `/tenant/requisicoes/${entId}/items`, token, tenantId, branchId, {
    produtoId,
    loteId,
    quantidadeSolicitada: 1,
  });
  addEnt.status === 201 || addEnt.status === 200 ? ok("add item ENTRADA") : bad("add ENTRADA item", addEnt);

  const apprEnt = await req("POST", `/tenant/requisicoes/${entId}/aprovar`, token, tenantId, branchId);
  apprEnt.status === 200 ? ok("approve ENTRADA + EstoqueMovimento") : bad("approve ENTRADA", apprEnt);
}

// SAIDA flow
const sai = await req("POST", "/tenant/requisicoes", token, tenantId, branchId, {
  numeroDocumento: `SAI-FLOW-${suffix}`,
  destino: "Loja B",
  fornecedorId,
  tipo: "SAIDA",
});
const saiId = unwrap(sai.data)?.requisicaoId;
if (sai.status !== 201 || !saiId) bad("create SAIDA", sai);
else ok("create SAIDA");

if (loteId) {
  const addSai = await req("POST", `/tenant/requisicoes/${saiId}/items`, token, tenantId, branchId, {
    produtoId,
    loteId,
    quantidadeSolicitada: 1,
  });
  addSai.status === 201 || addSai.status === 200 ? ok("add item SAIDA") : bad("add SAIDA item", addSai);

  const apprSai = await req("POST", `/tenant/requisicoes/${saiId}/aprovar`, token, tenantId, branchId);
  apprSai.status === 200 ? ok("approve SAIDA + stock debit") : bad("approve SAIDA", apprSai);
}

// Reject flow
const rej = await req("POST", "/tenant/requisicoes", token, tenantId, branchId, {
  numeroDocumento: `REJ-${suffix}`,
  destino: "X",
  tipo: "SAIDA",
});
const rejId = unwrap(rej.data)?.requisicaoId;
if (rejId) {
  const reject = await req("POST", `/tenant/requisicoes/${rejId}/rejeitar`, token, tenantId, branchId);
  reject.status === 200 ? ok("reject requisicao") : bad("reject", reject);
}

// Cancel flow
const can = await req("POST", "/tenant/requisicoes", token, tenantId, branchId, {
  numeroDocumento: `CAN-${suffix}`,
  destino: "Y",
  tipo: "SAIDA",
});
const canId = unwrap(can.data)?.requisicaoId;
if (canId) {
  const cancel = await req("POST", `/tenant/requisicoes/${canId}/cancelar`, token, tenantId, branchId);
  cancel.status === 200 ? ok("cancel requisicao") : bad("cancel", cancel);
}

// COMPRA flow
const compra = await req("POST", "/tenant/requisicoes", token, tenantId, branchId, {
  numeroDocumento: `COM-FLOW-${suffix}`,
  fornecedorId,
  tipo: "COMPRA",
});
const compraId = unwrap(compra.data)?.requisicaoId;
if (compra.status === 201 && compraId) {
  ok("create COMPRA");
  const addCompra = await req("POST", `/tenant/requisicoes/${compraId}/items`, token, tenantId, branchId, {
    produtoId,
    numeroLote: `LOTE-${suffix}`,
    dataValidade: new Date(Date.now() + 86400000 * 365).toISOString(),
    quantidadeSolicitada: 2,
    precoCompra: 10.5,
    precoVenda: 15,
  });
  addCompra.status === 201 ? ok("add COMPRA item") : bad("add COMPRA item", addCompra);

  const apprCompra = await req("POST", `/tenant/requisicoes/${compraId}/aprovar`, token, tenantId, branchId);
  apprCompra.status === 200 ? ok("approve COMPRA + receive stock") : bad("approve COMPRA", apprCompra);
} else bad("create COMPRA", compra);

console.log(`\n=== ${passed.length} passed, ${failed.length} failed ===`);
process.exit(failed.length ? 1 : 0);
