/**
 * Trimmed from TODD's services/purchase-flow.config.ts - only the Pulse
 * entry, and postConfirmRoute/loginReturnUrl point at this app's own root
 * ('/') and '/app' rather than TODD's '/pulse' sub-route, since this app IS
 * Pulse, not a page inside a larger app. Endpoint/field values (checkout
 * endpoint, confirm endpoint, checkoutUrlField, legacyAccessStorageKey) are
 * copied verbatim from the monorepo's PULSE_PURCHASE_FLOW - those are real
 * backend contract values, unaffected by where the frontend lives.
 */
export interface ProductPurchaseFlowConfig {
  productKey: 'pulse';
  loginReturnUrl: string;
  checkoutEndpoint: string;
  confirmEndpoint: string;
  successRoute: string;
  postConfirmRoute: string;
  checkoutUrlField?: string;
  checkoutCredentials?: RequestCredentials;
  confirmCredentials?: RequestCredentials;
  legacyAccessStorageKey?: string;
}

export const PULSE_PURCHASE_FLOW: ProductPurchaseFlowConfig = {
  productKey: 'pulse',
  loginReturnUrl: '/pricing',
  checkoutEndpoint: '/survey/checkout',
  confirmEndpoint: '/survey/checkout/confirm',
  successRoute: '/success',
  postConfirmRoute: '/app',
  checkoutUrlField: 'checkoutUrl',
  legacyAccessStorageKey: 'surveyPaidAccess',
};
