export function serializePrinter(row: any) {
  return {
    id: row.id.toString(),
    uuid: row.uuid,
    tenantId: row.tenantId.toString(),
    branchId: row.branchId.toString(),
    deviceId: row.deviceId?.toString() ?? null,
    name: row.name,
    type: row.type,
    connection: row.connection,
    ip: row.ip ?? null,
    port: row.port ?? null,
    model: row.model ?? null,
    manufacturer: row.manufacturer ?? null,
    active: Boolean(row.active),
    version: row.version,
    createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
    updatedAt: row.updatedAt?.toISOString?.() ?? row.updatedAt,
    deletedAt: row.deletedAt?.toISOString?.() ?? row.deletedAt ?? null,
    device: row.device
      ? {
          id: row.device.id.toString(),
          name: row.device.name,
          code: row.device.code,
        }
      : null,
    branch: row.branch
      ? {
          id: row.branch.id.toString(),
          code: row.branch.code,
          name: row.branch.name,
        }
      : null,
  };
}

export function serializePrintJob(row: any) {
  return {
    id: row.id.toString(),
    tenantId: row.tenantId.toString(),
    branchId: row.branchId.toString(),
    printerId: row.printerId.toString(),
    document: row.document,
    payload: row.payload,
    status: row.status,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    errorMessage: row.errorMessage ?? null,
    printedAt: row.printedAt?.toISOString?.() ?? row.printedAt ?? null,
    lockedAt: row.lockedAt?.toISOString?.() ?? row.lockedAt ?? null,
    lockedBy: row.lockedBy ?? null,
    createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
    updatedAt: row.updatedAt?.toISOString?.() ?? row.updatedAt,
    deletedAt: row.deletedAt?.toISOString?.() ?? row.deletedAt ?? null,
    printer: row.printer ? serializePrinter(row.printer) : null,
  };
}
