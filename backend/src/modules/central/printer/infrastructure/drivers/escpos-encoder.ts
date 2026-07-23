/**
 * Encoder ESC/POS mínimo (recibos térmicos 80mm).
 * Sem dependências externas — bytes raw.
 */
export class EscPosEncoder {
  private chunks: number[] = [];

  init(): this {
    // ESC @ — initialize
    this.chunks.push(0x1b, 0x40);
    return this;
  }

  align(mode: "left" | "center" | "right" = "left"): this {
    const n = mode === "center" ? 1 : mode === "right" ? 2 : 0;
    this.chunks.push(0x1b, 0x61, n);
    return this;
  }

  bold(on: boolean): this {
    this.chunks.push(0x1b, 0x45, on ? 1 : 0);
    return this;
  }

  text(value: string): this {
    const normalized = value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\x20-\x7E\n\r\t]/g, "?");
    for (let i = 0; i < normalized.length; i++) {
      this.chunks.push(normalized.charCodeAt(i));
    }
    return this;
  }

  line(value = ""): this {
    return this.text(`${value}\n`);
  }

  feed(lines = 1): this {
    this.chunks.push(0x1b, 0x64, Math.max(0, Math.min(255, lines)));
    return this;
  }

  cut(partial = true): this {
    // GS V
    this.chunks.push(0x1d, 0x56, partial ? 0x01 : 0x00);
    return this;
  }

  encode(): Uint8Array {
    return new Uint8Array(this.chunks);
  }
}

export function buildEscPosBytes(document: string, payload: unknown): Uint8Array {
  const data =
    payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const encoder = new EscPosEncoder().init().align("center").bold(true);

  if (document === "TEST" || data.kind === "TEST") {
    encoder
      .line("SKALWAY HEALTH")
      .bold(false)
      .line("Teste de impressao")
      .line("------------------------")
      .align("left")
      .line(String(data.message ?? "Impressora OK"))
      .line(`Data: ${new Date().toLocaleString("pt-MZ")}`)
      .feed(3)
      .cut();
    return encoder.encode();
  }

  const title = String(data.title ?? document);
  const lines = Array.isArray(data.lines)
    ? data.lines.map((line) => String(line))
    : [String(data.message ?? data.body ?? "")].filter(Boolean);

  encoder.line(title).bold(false).line("------------------------").align("left");
  for (const line of lines) {
    encoder.line(line);
  }
  if (data.footer) {
    encoder.line("------------------------").align("center").line(String(data.footer));
  }
  encoder.feed(3).cut();
  return encoder.encode();
}
