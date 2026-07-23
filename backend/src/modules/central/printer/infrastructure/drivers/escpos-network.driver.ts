import type {
  PrintDriverJob,
  PrintDriverResult,
  PrintDriverTarget,
  PrinterDriver,
} from "../../domain/drivers/printer-driver";
import { buildEscPosBytes } from "./escpos-encoder";

const DEFAULT_PORT = 9100;
const CONNECT_TIMEOUT_MS = 5_000;

/**
 * ESC/POS via TCP/IP (porta padrão 9100).
 */
export class EscPosNetworkDriver implements PrinterDriver {
  readonly name = "EscPosNetworkDriver";

  supports(target: PrintDriverTarget): boolean {
    const connection = target.connection.toUpperCase();
    const type = target.type.toUpperCase();
    return (
      connection === "NETWORK" &&
      (type === "ESC_POS" || type === "LABEL") &&
      Boolean(target.ip?.trim())
    );
  }

  async print(
    target: PrintDriverTarget,
    job: PrintDriverJob,
  ): Promise<PrintDriverResult> {
    const host = target.ip?.trim();
    if (!host) {
      return { success: false, errorMessage: "IP da impressora não configurado" };
    }

    const port = target.port && target.port > 0 ? target.port : DEFAULT_PORT;
    const bytes = buildEscPosBytes(job.document, job.payload);

    try {
      await sendTcpBytes(host, port, bytes, CONNECT_TIMEOUT_MS);
      return { success: true, bytesSent: bytes.byteLength };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Falha ao enviar ESC/POS";
      return { success: false, errorMessage: message, bytesSent: 0 };
    }
  }
}

async function sendTcpBytes(
  host: string,
  port: number,
  bytes: Uint8Array,
  timeoutMs: number,
): Promise<void> {
  const socket = await Promise.race([
    Bun.connect({
      hostname: host,
      port,
      socket: {
        data() {},
        open() {},
        close() {},
        error(_socket, error) {
          throw error;
        },
      },
    }),
    new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error(`Timeout a ligar a ${host}:${port}`)),
        timeoutMs,
      );
    }),
  ]);

  try {
    socket.write(bytes);
    // Pequena espera para flush em impressoras lentas
    await Bun.sleep(50);
    socket.end();
  } finally {
    try {
      socket.end();
    } catch {
      // ignore
    }
  }
}
