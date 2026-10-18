// ---------------------------------------------------------------------------
// Item categories a customer can choose when placing an order.
//
// NOTE: careful2.ca was unreachable when this app was built, so these are
// sensible PLACEHOLDER categories for a careful/parcel courier. Replace this
// array with the real categories from Careful2 — this is the single source of
// truth; the frontend fetches it from GET /api/categories.
// ---------------------------------------------------------------------------
export const ITEM_CATEGORIES: string[] = [
  "Documents & Envelopes",
  "Small Parcel",
  "Medium Parcel",
  "Large Parcel",
  "Fragile / Glassware",
  "Electronics",
  "Food & Groceries",
  "Medical / Pharmacy",
  "Flowers & Plants",
  "Furniture",
  "Other",
];

export function isValidCategory(c: string): boolean {
  return ITEM_CATEGORIES.includes(c);
}
