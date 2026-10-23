/** Keep the existing date and equal-date order; never infer clinical validity. */
export function latestRiskRecords<T extends { clientId: number; createdAt: string | Date }>(records: T[]): T[] {
  const sorted = [...records].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const selected = new Map<number, T>();
  for (const record of sorted) {
    const previous = selected.get(record.clientId);
    // Equal timestamps retain the old Map's last-in-input behavior. A different
    // source priority requires a business decision and is intentionally absent.
    if (!previous || new Date(record.createdAt).getTime() === new Date(previous.createdAt).getTime())
      selected.set(record.clientId, record);
  }
  return [...selected.values()];
}
