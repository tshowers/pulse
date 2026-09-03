import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PulsePurchaseFlowService } from '../../services/pulse-purchase-flow.service';
import { PULSE_PURCHASE_FLOW } from '../../services/purchase-flow.config';
import { ClickSoundDirective } from '../../shared/directives/click-sound.directive';

/**
 * Ported near-verbatim from the monorepo's
 * features/survey/pulse-paid-success/pulse-paid-success.component.ts
 * (~170 lines), using web-products/network's already-ported
 * paid-success.component.ts as the direct template for what to keep: the
 * confirm/success/error three-state card, `RouterLink` + `ClickSoundDirective`
 * for the CTAs. Like Network's port, drops the `ToddAssistantBusService`
 * signalState$ subscription and the `ngAfterViewInit` scroll-to-top call -
 * neither is core to confirming a checkout, and Pulse's assistant-signal
 * stub only ever emits 'idle' anyway, so subscribing to it here would be
 * dead weight.
 */
@Component( {
  selector: 'app-pulse-paid-success',
  standalone: true,
  imports: [CommonModule, RouterLink, ClickSoundDirective],
  templateUrl: './pulse-paid-success.component.html',
  styleUrl: './pulse-paid-success.component.css'
} )
export class PulsePaidSuccessComponent implements OnInit {
  private readonly purchaseFlowConfig = PULSE_PURCHASE_FLOW;
  private route = inject( ActivatedRoute );
  private router = inject( Router );

  isConfirming = true;
  isSuccess = false;
  errorMessage = '';

  constructor ( private purchaseFlowService: PulsePurchaseFlowService ) { }

  async ngOnInit (): Promise<void> {
    const sessionId = ( this.route.snapshot.queryParamMap.get( 'session_id' ) || '' ).trim();

    if ( !sessionId ) {
      this.isConfirming = false;
      this.errorMessage = 'Missing session information. Please try again.';
      return;
    }

    try {
      await this.purchaseFlowService.confirmCheckout( this.purchaseFlowConfig, sessionId );
      this.isSuccess = true;
    } catch ( err: any ) {
      this.errorMessage = err?.message || 'Something went wrong confirming your purchase.';
    } finally {
      this.isConfirming = false;
    }
  }

  goToPulse (): void {
    void this.router.navigate( [this.purchaseFlowConfig.postConfirmRoute] );
  }
}
