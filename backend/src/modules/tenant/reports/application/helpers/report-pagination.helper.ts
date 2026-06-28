export async function collectAllPages<T>(
  fetchPage: (page: number) => Promise<{ items: T[]; hasMore: boolean }>,
): Promise<T[]> {
  const items: T[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const result = await fetchPage(page);
    items.push(...result.items);
    hasMore = result.hasMore;
    page += 1;
  }

  return items;
}
