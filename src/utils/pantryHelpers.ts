import { PantryCardItem } from '../types';

/**
 * Filter and limit Used/Consumed pantry items (0 quantity):
 * 1. Sort by most recent first (updatedAt / createdAt / id)
 * 2. Keep maximum 2 items for the same Barcode + Batch combination
 * 3. Keep maximum 30 items overall on a rolling basis (oldest beyond 30 are removed/hidden)
 */
export const filterUsedPantryItems = <T extends PantryCardItem>(items: T[]): T[] => {
  if (!items || items.length === 0) return [];

  // Filter 0-quantity items
  const used = items.filter((i) => (i.quantity || 0) === 0);

  // Sort latest first
  const sorted = [...used].sort((a, b) => {
    const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime() || 0;
    const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime() || 0;
    if (timeB !== timeA) return timeB - timeA;
    return b.id.localeCompare(a.id);
  });

  // Max 2 items per (barcode + batch)
  const barcodeBatchCounts: Record<string, number> = {};
  const deduplicated: T[] = [];

  for (const item of sorted) {
    const barcode = (item.barcode || '').trim().toLowerCase();
    const batch = (item.batchNumber || item.batchId || '').trim().toLowerCase();
    const key = barcode && batch ? `${barcode}_${batch}` : item.id;

    const count = barcodeBatchCounts[key] || 0;
    if (count < 2) {
      barcodeBatchCounts[key] = count + 1;
      deduplicated.push(item);
    }
  }

  // Max 30 items overall (rolling window of 30 most recent used products)
  return deduplicated.slice(0, 30);
};
