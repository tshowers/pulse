/**
 * Trimmed from shared/data/interfaces/product.model.ts - only the fields
 * pulse-pricing actually reads (per-tenant custom pricing overrides stored
 * on the tenant's own contact.company.products). Copied from Network's
 * identical trim (web-products/network/src/app/models/product.model.ts).
 */
export interface Product {
  name?: string;
  active?: boolean;
  discontinued?: boolean;
  description: string;
  shortDescription?: string;
  priceLabel?: string;
  stripePriceIdMonthly?: string;
}
