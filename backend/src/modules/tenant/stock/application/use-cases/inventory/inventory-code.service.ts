export async function generateInventarioCodigo(tx: {
  inventario: {
    count: (args: { where: { codigo: { startsWith: string } } }) => Promise<number>;
  };
}): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const count = await tx.inventario.count({
    where: { codigo: { startsWith: prefix } },
  });

  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}
