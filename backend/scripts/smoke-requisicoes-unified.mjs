const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3300/api/v1";
const EMAIL = process.env.AUDIT_EMAIL ?? "dono.1781095907@demo.com";
const PASS = process.env.AUDIT_PASSWORD ?? "123456";

const passed = [];
const failed = [];

function ok(name) {
  passed.push(name);
  console.log(`PASS ${name}`);
}
function fail(name, detail) {
  failed.push({ name, detail });
  console.log(`FAIL ${name}`, typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 300));
}

async function req(method, path, token, tenantId, branchId, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "x-tenant-id": tenantId,
        "x-branch-id": branchId,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}

const loginRes = await fetch(`${BASE}/central/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASS }),
}).then((r) => r.json());

const token = loginRes?.data?.token;
if (!token) {
  fail("login", loginRes);
  console.log(`\n${passed.length} pass / ${failed.length} fail`);
  process.exit(1);
}

const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
const tenantId = payload.tenants[0].id;
const branchId = payload.tenants[0].branches[0].id;
ok(`login tenant=${tenantId}`);

function unwrap(payload) {
  if (payload?.success === true && payload?.data !== undefined) return payload.data;
  return payload;
}

const suppliers = await req("GET", "/tenant/fornecedores", token, tenantId, branchId);
const supplierList = unwrap(suppliers.data);
if (suppliers.status === 200 && Array.isArray(supplierList) && supplierList.length > 0) {
  ok("list fornecedores");
} else {
  fail("list fornecedores", suppliers);
}

const fornecedorId = supplierList?.[0]?.id;
const suffix = Date.now();

const createCompra = await req("POST", "/tenant/requisicoes", token, tenantId, branchId, {
  numeroDocumento: `COMPRA-${suffix}`,
  fornecedorId,
  tipo: "COMPRA",
});
if (createCompra.status === 201) ok("create COMPRA via /requisicoes");
else fail("create COMPRA", createCompra);

const compraId = createCompra.data?.requisicaoId ?? createCompra.data?.id;

const listCompra = await req("GET", "/tenant/requisicoes?tipo=COMPRA&status=PENDENTE", token, tenantId, branchId);
const compraList = unwrap(listCompra.data);
if (listCompra.status === 200 && Array.isArray(compraList)) ok("list COMPRA filtered");
else fail("list COMPRA", listCompra);

const legacy = await req("POST", "/tenant/compras", token, tenantId, branchId, {
  numeroDocumento: `LEGACY-${suffix}`,
  fornecedorId,
});
if (legacy.status === 201) ok("legacy POST /compras delegates");
else fail("legacy /compras", legacy);

const ent = await req("POST", "/tenant/requisicoes", token, tenantId, branchId, {
  numeroDocumento: `ENT-${suffix}`,
  origem: "Armazem Central",
  fornecedorId,
  tipo: "ENTRADA",
});
if (ent.status === 201) ok("create ENTRADA with fornecedorId");
else fail("create ENTRADA", ent);

const sai = await req("POST", "/tenant/requisicoes", token, tenantId, branchId, {
  numeroDocumento: `SAI-${suffix}`,
  destino: "Loja B",
  fornecedorId,
  tipo: "SAIDA",
});
if (sai.status === 201) ok("create SAIDA with fornecedorId");
else fail("create SAIDA", sai);

const badTenant = await req("GET", "/tenant/requisicoes", token, "999999", branchId);
if (badTenant.status === 403) ok("multi-tenant HTTP 403");
else fail("multi-tenant", badTenant);

// Cancel COMPRA draft (cleanup)
if (compraId) {
  const cancel = await req("POST", `/tenant/requisicoes/${compraId}/cancelar`, token, tenantId, branchId);
  if (cancel.status === 200) ok("cancel COMPRA");
  else fail("cancel COMPRA", cancel);
}

console.log(`\n=== ${passed.length} passed, ${failed.length} failed ===`);
if (failed.length) process.exit(1);
