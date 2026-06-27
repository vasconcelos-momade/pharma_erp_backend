export function buildPagedTableResult({
  table,
  page,
  pageSize,
  totalCount,
  rows,
}: {
  table: string;
  page: number;
  pageSize: number;
  totalCount: number;
  rows: unknown[];
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  return {
    table,
    items: rows.slice(0, pageSize),
    page,
    pageSize,
    hasMore: rows.length > pageSize,
    hasPrevious: page > 1,
    totalCount,
    totalPages,
  };
}

export function normalizeTablePagination(params: {
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, params.pageSize ?? 10));
  return { page, pageSize };
}
