/** Run async work in small groups so clinic rosters cannot open thousands of sockets. */
export async function mapInBatches<T, R>(
  items: T[],
  batchSize: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const size = Math.max(1, batchSize);
  const results: R[] = [];
  for (let index = 0; index < items.length; index += size) {
    const chunk = items.slice(index, index + size);
    results.push(...(await Promise.all(chunk.map(mapper))));
  }
  return results;
}
