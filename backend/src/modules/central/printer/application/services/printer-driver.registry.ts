import type {
  PrintDriverResult,
  PrintDriverTarget,
  PrinterDriver,
} from "../../domain/drivers/printer-driver";
import { EscPosNetworkDriver } from "../../infrastructure/drivers/escpos-network.driver";
import { PdfDriver } from "../../infrastructure/drivers/pdf.driver";

export class PrinterDriverRegistry {
  private readonly drivers: PrinterDriver[];

  constructor(drivers?: PrinterDriver[]) {
    this.drivers = drivers ?? [new EscPosNetworkDriver(), new PdfDriver()];
  }

  resolve(target: PrintDriverTarget, options?: { forcePdf?: boolean }): PrinterDriver {
    if (options?.forcePdf) {
      const pdf = this.drivers.find((item) => item.name === "PdfDriver");
      if (pdf) return pdf;
    }

    const driver = this.drivers.find((item) => item.supports(target));
    if (!driver) {
      throw new Error(
        `Nenhum driver para impressora ${target.name} (${target.type}/${target.connection})`,
      );
    }
    return driver;
  }

  async print(
    target: PrintDriverTarget,
    job: { jobId: string; document: string; payload: unknown },
    options?: { forcePdf?: boolean },
  ): Promise<PrintDriverResult & { driver: string }> {
    const driver = this.resolve(target, options);
    const result = await driver.print(target, job);
    return { ...result, driver: driver.name };
  }
}
