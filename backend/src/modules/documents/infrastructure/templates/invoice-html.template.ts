import type { InvoiceDocumentSnapshotPayload } from "../../domain/document.types";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function money(value: number, currency: string) {
  return `${value.toFixed(2)} ${currency}`;
}

export function renderInvoiceHtmlTemplate(snapshot: InvoiceDocumentSnapshotPayload) {
  const rows = snapshot.items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.description)}</td>
          <td class="numeric">${item.quantity.toFixed(item.quantity % 1 === 0 ? 0 : 2)}</td>
          <td class="numeric">${money(item.unitPrice, snapshot.currency)}</td>
          <td class="numeric">${item.taxPercent.toFixed(item.taxPercent % 1 === 0 ? 0 : 2)}%</td>
          <td class="numeric">${money(item.total, snapshot.currency)}</td>
        </tr>
      `,
    )
    .join("");

  const paymentRows = snapshot.payment.entries
    .map(
      (payment) => `
        <tr>
          <td>${escapeHtml(payment.method)}</td>
          <td>${escapeHtml(payment.status)}</td>
          <td class="numeric">${money(payment.amount, snapshot.currency)}</td>
        </tr>
      `,
    )
    .join("");

  return `<!DOCTYPE html>
  <html lang="pt">
    <head>
      <meta charset="UTF-8" />
      <title>${escapeHtml(snapshot.number)}</title>
      <style>
        @page { size: A4; margin: 12mm; }
        body {
          font-family: Arial, Helvetica, sans-serif;
          color: #0f172a;
          font-size: 12px;
          margin: 0;
        }
        .page { display: flex; flex-direction: column; gap: 16px; }
        .header, .totals, .payments, .footer, .meta {
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 12px;
        }
        .brand { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
        .brand h1 { margin: 0; font-size: 22px; }
        .muted { color: #475569; }
        .title-row { display: flex; justify-content: space-between; gap: 12px; }
        .title-box { text-align: right; }
        .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border-bottom: 1px solid #e2e8f0; padding: 8px 6px; text-align: left; vertical-align: top; }
        th { background: #f8fafc; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; }
        .numeric { text-align: right; }
        .totals-grid { display: grid; grid-template-columns: 1fr auto; gap: 8px 24px; max-width: 320px; margin-left: auto; }
        .qr { width: 132px; height: 132px; object-fit: contain; }
        .pill {
          display: inline-block;
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 11px;
          background: #e2e8f0;
        }
      </style>
    </head>
    <body>
      <div class="page">
        <section class="header">
          <div class="brand">
            <div>
              <h1>${escapeHtml(snapshot.branding.companyName)}</h1>
              <div class="muted">${escapeHtml(snapshot.branding.tagline ?? "")}</div>
              <div class="muted">${escapeHtml(snapshot.branding.address ?? "")}</div>
              <div class="muted">${escapeHtml(snapshot.branding.taxId ?? "")}</div>
            </div>
            <div class="title-box">
              <div class="pill">${escapeHtml(snapshot.status)}</div>
              <h2>${escapeHtml(snapshot.type)} ${escapeHtml(snapshot.number)}</h2>
              <div class="muted">Serie: ${escapeHtml(snapshot.series ?? "-")}</div>
              <div class="muted">Emitida em: ${escapeHtml(new Date(snapshot.createdAt).toLocaleString("pt-PT"))}</div>
            </div>
          </div>
        </section>

        <section class="meta">
          <div class="grid">
            <div>
              <strong>Cliente</strong>
              <div>${escapeHtml(snapshot.customer.name)}</div>
              <div class="muted">${escapeHtml(snapshot.customer.document ?? "-")}</div>
            </div>
            <div>
              <strong>Operacao</strong>
              <div>${escapeHtml(snapshot.fiscal.operationType ?? "-")}</div>
              <div class="muted">Metodo: ${escapeHtml(snapshot.payment.method ?? "-")}</div>
              <div class="muted">Terminal: ${escapeHtml(snapshot.terminal.code ?? snapshot.terminal.name ?? "-")}</div>
            </div>
          </div>
        </section>

        <section>
          <table>
            <thead>
              <tr>
                <th>Descricao</th>
                <th>Qtd</th>
                <th>Preco Unit.</th>
                <th>IVA</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </section>

        <section class="totals">
          <div class="totals-grid">
            <div>Subtotal</div>
            <div>${money(snapshot.totals.subtotal, snapshot.currency)}</div>
            <div>Desconto</div>
            <div>${money(snapshot.totals.discount, snapshot.currency)}</div>
            <div>IVA</div>
            <div>${money(snapshot.totals.tax, snapshot.currency)}</div>
            <div><strong>Total</strong></div>
            <div><strong>${money(snapshot.totals.total, snapshot.currency)}</strong></div>
          </div>
        </section>

        <section class="payments">
          <strong>Pagamentos</strong>
          <table>
            <thead>
              <tr>
                <th>Metodo</th>
                <th>Estado</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>${paymentRows || '<tr><td colspan="3">Sem pagamentos.</td></tr>'}</tbody>
          </table>
        </section>

        <section class="footer">
          <div class="title-row">
            <div>
              <strong>Observacoes Fiscais</strong>
              ${snapshot.fiscal.legalText.map((line) => `<div class="muted">${escapeHtml(line)}</div>`).join("")}
            </div>
            ${
              snapshot.fiscal.qrCodeDataUrl
                ? `<img class="qr" src="${snapshot.fiscal.qrCodeDataUrl}" alt="QR fiscal" />`
                : ""
            }
          </div>
        </section>
      </div>
    </body>
  </html>`;
}
