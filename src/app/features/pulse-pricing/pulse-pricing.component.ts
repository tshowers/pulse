import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AfterViewInit, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { PulseAuthService } from '../../services/pulse-auth.service';
import { PulseEntitlementService } from '../../services/pulse-entitlement.service';
import { AffiliateReferrerService } from '../../services/affiliate-referrer.service';
import { PulseDataService } from '../../services/pulse-data.service';
import { PulsePurchaseFlowService } from '../../services/pulse-purchase-flow.service';
import { PULSE_PURCHASE_FLOW } from '../../services/purchase-flow.config';
import { Product } from '../../models/product.model';
import { ClickSoundDirective } from '../../shared/directives/click-sound.directive';

const DEFAULT_PRICE = '$9/month';
const DEFAULT_HIGHLIGHTS = [
  'Create as many surveys as you want.',
  'Publish surveys and start collecting responses.',
  'Turn answers into signals you can act on.'
];
const DEFAULT_NOTES = [
  'Survey creation stays free.',
  'Publishing and collecting responses requires an active Pulse plan.',
  'Once activated, you can publish without the free-plan wall.'
];

/**
 * Trimmed, near-verbatim port of the monorepo's
 * features/survey/pulse-pricing/pulse-pricing.component.ts (671 lines),
 * using web-products/network's already-ported pricing.component.ts as the
 * direct template - same structural swap (drops the
 * ToddAssistantBusService signal-state indicator and
 * AffiliateTrackingService for the minimal AffiliateReferrerService stub;
 * the checkout flow itself is unchanged, a real-money code path).
 *
 * Deviation from a pure near-verbatim port: the monorepo's own
 * pulse-pricing.component.css only has *color* overrides for
 * `.pulse-pricing-login-callout`/`-title`/`-text`/`-btn` (light/dark theme
 * blocks), never base layout rules - those classes render unstyled even in
 * the monorepo today. Network's pricing.component.css has full base rules
 * for the equivalent classes, so those were carried over here instead of
 * reproducing the gap.
 */
@Component( {
  selector: 'app-pulse-pricing',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ClickSoundDirective],
  templateUrl: './pulse-pricing.component.html',
  styleUrl: './pulse-pricing.component.css'
} )
export class PulsePricingComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly entitlements$ = inject( PulseEntitlementService ).getEntitlements();
  private readonly purchaseFlowConfig = PULSE_PURCHASE_FLOW;
  private authService = inject( PulseAuthService );
  private router = inject( Router );
  private dataService = inject( PulseDataService );

  tenantIdSubscription!: Subscription;
  userSubscription!: Subscription;

  private tenantProduct: Product | null = null;

  email = '';
  tenantId = '';
  isStartingCheckout = false;
  checkoutError = '';
  requiresLogin = false;

  get monthlyPrice (): string {
    return this.tenantProduct?.priceLabel || DEFAULT_PRICE;
  }

  get highlights (): string[] {
    const d = this.tenantProduct?.shortDescription;
    return d ? [d] : DEFAULT_HIGHLIGHTS;
  }

  get notes (): string[] {
    const d = this.tenantProduct?.description;
    return d ? [d] : DEFAULT_NOTES;
  }

  constructor (
    private affiliateReferrerService: AffiliateReferrerService,
    private purchaseFlowService: PulsePurchaseFlowService
  ) { }

  ngOnInit (): void {
    this.userSubscription = this.authService.getUser().subscribe( firebaseUser => {
      this.email = firebaseUser?.email || '';
      this.requiresLogin = !firebaseUser;
    } );

    this.tenantIdSubscription = this.authService.getTenantId().subscribe( async tenantId => {
      this.tenantId = tenantId || '';
      if ( this.tenantId ) {
        await this.loadTenantProduct( 'pulse' );
      }
    } );
  }

  ngAfterViewInit (): void {
    window.scrollTo( 0, 0 );
  }

  ngOnDestroy (): void {
    if ( this.userSubscription ) this.userSubscription.unsubscribe();
    if ( this.tenantIdSubscription ) this.tenantIdSubscription.unsubscribe();
  }

  goToLogin (): void {
    void this.purchaseFlowService.goToLogin( this.router, this.purchaseFlowConfig );
  }

  private async loadTenantProduct ( productName: string ): Promise<void> {
    try {
      const contact = await this.dataService.getContact( this.tenantId, this.tenantId );
      const products: Product[] = contact?.company?.products || [];
      this.tenantProduct = products.find(
        p => p.active !== false && p.discontinued !== true &&
             p.name?.toLowerCase().includes( productName )
      ) || null;
    } catch {
      this.tenantProduct = null;
    }
  }

  async startCheckout (): Promise<void> {
    this.checkoutError = '';
    this.requiresLogin = !this.email;

    if ( this.requiresLogin ) {
      this.checkoutError = 'Please sign in before purchasing Pulse publishing.';
      return;
    }

    const tenantId = this.tenantId.trim();
    const email = this.email.trim().toLowerCase();

    if ( !tenantId ) {
      this.requiresLogin = true;
      this.checkoutError = 'We could not find you. Please sign in again and try once more.';
      return;
    }

    if ( !email ) {
      this.checkoutError = 'Email is required before checkout.';
      return;
    }

    this.isStartingCheckout = true;

    try {
      const checkoutUrl = await this.purchaseFlowService.startCheckout(
        this.purchaseFlowConfig,
        {
          tenantId,
          email,
          priceId: this.tenantProduct?.stripePriceIdMonthly || '',
          referrerUid: this.affiliateReferrerService.getReferrerUid() || ''
        },
        'Unable to start Pulse checkout.'
      );

      this.purchaseFlowService.redirectToCheckout( checkoutUrl );
    } catch ( error: any ) {
      this.checkoutError = error?.message || 'Unable to start Pulse checkout.';
      this.isStartingCheckout = false;
    }
  }
}
