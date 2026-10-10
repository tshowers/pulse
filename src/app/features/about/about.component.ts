import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { IconComponent } from '../../shared/icon/icon.component';
import { PulseLogoComponent } from '../../shared/pulse-logo/pulse-logo.component';
import { SiteFooterComponent } from '../../shared/site-footer/site-footer.component';

/** About (design_handoff_todd_pulse 2b): what Pulse is, who it's for, how it fits into TODD, and what respondents can count on. */
@Component( {
  selector: 'app-about',
  standalone: true,
  imports: [RouterLink, IconComponent, PulseLogoComponent, SiteFooterComponent],
  template: `
    <div class="ab">
      <section class="ab-intro">
        <div class="ab-intro__copy">
          <span class="p-eyebrow">About Pulse</span>
          <h1>Pulse is how TODD listens</h1>
          <p>TODD is the assistant that helps small teams decide their next move. Pulse is the part that asks your customers, users and team a few focused questions, so each move is based on what people actually said instead of a guess.</p>
        </div>
        <app-pulse-logo class="ab-logo" />
      </section>

      <section class="ab-section">
        <h2>Who it's for</h2>
        <div class="ab-grid">
          @for (a of audiences; track a.title) {
            <div class="ab-aud p-tinted" [attr.data-tint]="a.tint">
              <span class="ab-aud__icon"><app-icon [name]="a.icon" [size]="18" /></span>
              <span class="ab-aud__title">{{ a.title }}</span>
              <span class="ab-aud__copy">{{ a.copy }}</span>
            </div>
          }
        </div>
      </section>

      <section class="ab-pair">
        <div class="p-card ab-card">
          <span class="p-eyebrow">Part of TODD</span>
          <span class="ab-card__title">What you learn here shows up elsewhere</span>
          <span class="ab-card__copy">Your daily briefing tracks your live pulses alongside everything else on your plate, and Maya can start a new pulse straight out of a conversation instead of you starting from a blank screen.</span>
        </div>
        <div class="p-card ab-card">
          <span class="p-eyebrow">For the people answering</span>
          @for (p of promises; track p.title) {
            <div class="ab-promise">
              <span class="p-check-dot"><app-icon name="check" [size]="14" /></span>
              <span><b>{{ p.title }}</b><span>{{ p.copy }}</span></span>
            </div>
          }
        </div>
      </section>

      <section class="p-todd ab-cta">
        <img class="p-avatar" src="assets/TODD-icon.png" alt="" width="64" height="64" />
        <div class="ab-cta__copy">
          <span class="ab-cta__title">Have a decision you're unsure about?</span>
          <span class="ab-cta__sub">Tell TODD and she'll write the questions to settle it.</span>
        </div>
        <a class="p-btn p-btn--primary ab-cta__btn" routerLink="/get-started">Get started free</a>
      </section>
    </div>
    <app-site-footer><a routerLink="/">Home</a><a routerLink="/help">Help</a><a routerLink="/pricing">Pricing</a></app-site-footer>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; min-height: calc(100dvh - 82px); }
    .ab { flex: 1 0 auto; width: 100%; max-width: 1280px; margin: 0 auto; box-sizing: border-box; padding: 48px 40px 40px; font-family: var(--font); color: var(--text); display: flex; flex-direction: column; gap: 64px; }
    .ab-intro { display: grid; grid-template-columns: minmax(0, 860px) 280px; justify-content: space-between; align-items: center; gap: 48px; }
    .ab-intro__copy { display: flex; flex-direction: column; gap: 18px; }
    .ab-logo { width: 280px; }
    .ab-intro h1 { margin: 0; font-size: 60px; font-weight: 700; letter-spacing: -0.04em; line-height: 1.02; }
    .ab-intro p { margin: 0; font-size: 19px; line-height: 1.6; text-wrap: pretty; }
    .ab-section { display: flex; flex-direction: column; gap: 20px; }
    .ab-section h2 { margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.02em; }
    .ab-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
    .ab-aud { display: flex; flex-direction: column; gap: 10px; padding: 26px; border-radius: 28px; }
    .ab-aud__icon { width: 44px; height: 44px; border-radius: 50%; background: var(--bg); display: flex; align-items: center; justify-content: center; margin-bottom: 4px; }
    .ab-aud__title { font-size: 20px; font-weight: 700; letter-spacing: -0.01em; }
    .ab-aud__copy { font-size: 15px; line-height: 1.6; }
    .ab-pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: -24px; }
    .ab-card { padding: 28px; display: flex; flex-direction: column; gap: 14px; }
    .ab-card__title { font-size: 22px; font-weight: 700; letter-spacing: -0.01em; }
    .ab-card__copy { font-size: 15px; line-height: 1.6; color: var(--muted); }
    .ab-promise { display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: 12px; align-items: start; }
    .ab-promise > span:last-child { display: flex; flex-direction: column; gap: 2px; font-size: 14px; line-height: 1.5; color: var(--muted); }
    .ab-promise b { font-size: 16px; color: var(--text); }
    .ab-cta { border-radius: 36px; padding: 40px 44px; display: flex; align-items: center; gap: 24px; flex-wrap: wrap; }
    .ab-cta__copy { flex: 1; min-width: 240px; display: flex; flex-direction: column; gap: 6px; }
    .ab-cta__title { font-size: 30px; font-weight: 700; letter-spacing: -0.02em; }
    .ab-cta__sub { font-size: 16px; color: var(--t-blue-fg); }
    .ab-cta__btn { height: 54px; padding: 0 28px; font-size: 16px; }
    @media (max-width: 900px) {
      .ab-grid, .ab-pair { grid-template-columns: minmax(0, 1fr); }
      .ab-intro { grid-template-columns: minmax(0, 1fr); gap: 28px; }
      .ab-logo { width: 160px; order: -1; }
    }
    @media (max-width: 760px) {
      .ab { padding: 24px 16px 32px; gap: 48px; }
      .ab-intro h1 { font-size: 40px; }
      .ab-intro p { font-size: 17px; }
      .ab-pair { margin-top: -16px; }
      .ab-cta { padding: 28px 22px; border-radius: 28px; }
      .ab-cta__title { font-size: 24px; }
    }
  `],
} )
export class AboutComponent {
  readonly audiences = [
    { title: 'Small business owners', tint: 'blue', icon: 'users', copy: 'Find out why customers come back, why they stop, and what they wish you offered — without hiring a research firm.' },
    { title: 'Founders and product leads', tint: 'violet', icon: 'spark', copy: 'Check a pricing idea, a feature, or a message with real users before you spend the time building it.' },
    { title: 'Team leads', tint: 'pink', icon: 'msg', copy: 'Run a quick check-in with your team and see where people agree, where they don’t, and what is getting in the way.' },
  ];

  readonly promises = [
    { title: 'No account needed', copy: 'Anyone with the link can answer on any phone or computer.' },
    { title: 'One answer per device', copy: 'The same browser can’t submit the same pulse twice.' },
    { title: 'Owners can’t answer their own', copy: 'So your test answers never skew your results.' },
  ];
}
