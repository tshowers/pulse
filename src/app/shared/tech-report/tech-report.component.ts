import { AfterViewInit, Component, DestroyRef, ElementRef, EventEmitter, Input, OnChanges, Output, inject, signal } from '@angular/core';

import { ReportView } from './tech-report.view';

/**
 * The paid report as a consulting deliverable (design handoff "Tech Rescue
 * report redesign", 2026-11-09): top bar, navy cover, sticky contents, then
 * the verdict, scorecard, cost of waiting, findings, 30-day plan, keep / fix
 * / replace, questions and the appendix. Branded by the Pulse owner.
 *
 * Used by the respondent's page (/report/:token) and, embedded, by the
 * owner's Preview in Pulse > Reports. Every value comes from ReportView
 * (tech-report.view.ts); the template computes nothing.
 *
 * Download PDF prints the page: the print stylesheet swaps in a full-bleed
 * cover page, adds the running header and footer (@page margin boxes, set
 * per report below) and keeps every card on one page.
 */
@Component( {
  selector: 'app-tech-report',
  standalone: true,
  template: `
    @if (view; as v) {
    <div class="tr" [class.tr--embedded]="embedded" [class.tr--preview]="v.mode === 'preview'">
      <header class="tr-top">
        <span class="tr-mark" aria-hidden="true">{{ v.initials }}</span>
        <span class="tr-top__name"><span>{{ v.ownerName }}</span><span class="tr-top__product">&nbsp;·&nbsp;{{ v.productName }}</span></span>
        <span class="tr-top__fill"></span>
        @if (v.mode === 'full') {
          <button type="button" class="tr-btn tr-btn--ghost" (click)="print()" data-cy="report-pdf"><span aria-hidden="true">↓</span> <span class="tr-wide">Download PDF</span><span class="tr-narrow">PDF</span></button>
        }
        @if (debriefUrl && v.mode === 'full') {
          <a class="tr-btn tr-btn--primary tr-wide" [href]="debriefUrl" target="_blank" rel="noopener">Book your debrief</a>
        }
      </header>

      <!-- Print only: the full-bleed cover page. -->
      <section class="tr-pdfcover" aria-hidden="true">
        <div class="tr-pdfcover__in">
          <div class="tr-pdfcover__brand"><span class="tr-mark tr-mark--light">{{ v.initials }}</span><span>{{ v.ownerName }}</span></div>
          <div class="tr-pdfcover__body">
            <span class="tr-eyebrow tr-brass">{{ v.productName }}</span>
            <span class="tr-serif tr-pdfcover__client">{{ v.client }}</span>
            <span class="tr-pdfcover__project">{{ v.project }}</span>
            <span class="tr-pdfcover__rule"></span>
            <div class="tr-pdfcover__meta">
              @for (m of v.pdfMeta; track m.label) { <div><span>{{ m.label }}</span><span>{{ m.value }}</span></div> }
            </div>
            <div class="tr-foot tr-pdfcover__foot"><span>CONFIDENTIAL</span><span>{{ v.ownerWebsite }}</span></div>
          </div>
        </div>
      </section>

      <section class="tr-cover">
        <div class="tr-cover__in">
          <span class="tr-eyebrow tr-brass">{{ v.eyebrow }}</span>
          <h1 class="tr-serif tr-cover__client">{{ v.client }}</h1>
          @if (v.project) { <span class="tr-cover__project">{{ v.project }}</span> }
          <div class="tr-meta">
            @for (m of v.meta; track m.label) { <div><span>{{ m.label }}</span><span>{{ m.value }}</span></div> }
          </div>
        </div>
      </section>

      <div class="tr-body">
        <nav class="tr-nav" aria-label="Contents">
          <div class="tr-nav__in">
            <div class="tr-toc">
              @for (item of v.nav; track item.id) {
                <button type="button" [class.on]="item.id === active()" (click)="go(item.id)"><b>{{ item.num }}</b>{{ item.title }}</button>
              }
            </div>
            @if (debriefUrl && v.mode === 'full') {
              <div class="tr-navcard">
                <span class="tr-lbl">Your debrief</span>
                <span class="tr-navcard__text">Walk through this report with us.</span>
                <a class="tr-btn tr-btn--primary tr-btn--sm" [href]="debriefUrl" target="_blank" rel="noopener">Book a time</a>
              </div>
            }
          </div>
        </nav>

        <main class="tr-main">
          <section class="tr-sec" id="tr-verdict" data-sec="verdict">
            <div class="tr-sh"><span class="tr-sh__n">{{ v.num['verdict'] }}</span><h2 class="tr-sh__t">The verdict</h2></div>
            <div class="tr-status">
              <span class="tr-pill" [attr.data-tone]="v.status.tone"><span class="tr-dot"></span>{{ v.status.label }}</span>
              @if (v.statusNote) { <span class="tr-status__note">{{ v.statusNote }}</span> }
            </div>
            <p class="tr-serif tr-quote" data-cy="report-verdict">{{ v.verdict }}</p>
            @if (v.actions.length) {
              <span class="tr-lbl tr-lbl--gap">Do these {{ v.actions.length === 3 ? 'three things' : 'things' }} this week</span>
              <div class="tr-actions">
                @for (a of v.actions; track a.num) {
                  <div class="tr-card tr-action">
                    <span class="tr-serif tr-action__n">{{ a.num }}</span>
                    <div><span class="tr-action__t">{{ a.title }}</span>@if (a.detail) { <span class="tr-action__d">{{ a.detail }}</span> }</div>
                  </div>
                }
              </div>
            }
          </section>

          @if (v.mode === 'preview') {
            <!-- Placeholders only: the locked sections never reach this page. -->
            <section class="tr-locked" data-cy="report-locked">
              <div class="tr-locked__blur" aria-hidden="true">
                <div class="tr-sh"><span class="tr-sh__n">02</span><h2 class="tr-sh__t">Health scorecard</h2></div>
                <div class="tr-grid2">
                  @for (n of placeholders; track n) {
                    <div class="tr-card tr-tile">
                      <div class="tr-tile__head"><span class="tr-ph" style="width:40%"></span><span class="tr-ph tr-ph--pill"></span></div>
                      <div class="tr-segs">@for (s of [1,2,3,4,5]; track s) { <span [class.on]="s <= (n % 3) + 1"></span> }</div>
                      <span class="tr-ph" style="width:75%"></span>
                    </div>
                  }
                </div>
              </div>
              <div class="tr-unlock">
                <div class="tr-card tr-unlock__card">
                  <span class="tr-eyebrow tr-brass-ink">Free preview</span>
                  <span class="tr-serif tr-unlock__title">The full diagnostic is ready to unlock.</span>
                  <div class="tr-unlock__list">
                    @for (item of v.unlockItems; track item) { <span><b>✓</b>{{ item }}</span> }
                  </div>
                  <div class="tr-unlock__row">
                    <button type="button" class="tr-btn tr-btn--primary tr-btn--lg" (click)="unlock.emit()" [disabled]="busy" data-cy="report-unlock">{{ busy ? 'Opening checkout…' : v.unlockLabel }}</button>
                    <span class="tr-unlock__note">{{ v.unlockNote }}<br>Secure payment by Stripe.</span>
                  </div>
                  @if (error) { <p class="tr-error" role="alert">{{ error }}</p> }
                </div>
              </div>
            </section>
          } @else {
            @if (v.tiles.length) {
              <section class="tr-sec" id="tr-scorecard" data-sec="scorecard">
                <div class="tr-sh"><span class="tr-sh__n">{{ v.num['scorecard'] }}</span><h2 class="tr-sh__t">Health scorecard</h2></div>
                <p class="tr-lede">{{ v.scorecardIntro }}</p>
                <div class="tr-grid2">
                  @for (t of v.tiles; track $index) {
                    <div class="tr-card tr-tile">
                      <div class="tr-tile__head"><span class="tr-tile__area">{{ t.area }}</span><span class="tr-pill" [attr.data-tone]="t.tone"><span class="tr-dot"></span>{{ t.label }}</span></div>
                      <div class="tr-segs" [attr.data-tone]="t.tone">@for (on of t.segments; track $index) { <span [class.on]="on"></span> }</div>
                      @if (t.note) { <span class="tr-tile__note">{{ t.note }}</span> }
                    </div>
                  }
                </div>
                <div class="tr-legend">
                  <span><span class="tr-legend__dot" data-tone="r"></span>Off track</span>
                  <span><span class="tr-legend__dot" data-tone="a"></span>At risk / unverified</span>
                  <span><span class="tr-legend__dot" data-tone="g"></span>Healthy</span>
                </div>
              </section>
            }

            @if (v.cost; as c) {
              <section class="tr-sec" id="tr-cost" data-sec="cost">
                <div class="tr-sh"><span class="tr-sh__n">{{ v.num['cost'] }}</span><h2 class="tr-sh__t">The cost of waiting</h2></div>
                <div class="tr-card tr-cost">
                  <div class="tr-cost__stats">
                    @for (s of c.stats; track s.label) { <div><span class="tr-serif tr-cost__big">{{ s.value }}</span><span class="tr-cost__lbl">{{ s.label }}</span></div> }
                  </div>
                  <div class="tr-cost__chart">
                    <span class="tr-lbl">If nothing changes</span>
                    @if (c.headline) { <span class="tr-cost__head">{{ c.headline }}</span> }
                    @if (c.bars.length) {
                      <svg viewBox="0 0 420 230" class="tr-cost__svg" role="img" [attr.aria-label]="c.headline || 'Cost if nothing changes'">
                        <line x1="10" y1="200" x2="410" y2="200" stroke="#e7e3da" />
                        @for (b of c.bars; track $index) {
                          <rect [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.width" [attr.height]="b.height" rx="6" [attr.fill]="b.fill" [attr.opacity]="b.opacity" />
                          <text [attr.x]="b.center" [attr.y]="b.y - 10" text-anchor="middle" font-size="14" font-weight="700" fill="#10161f">{{ b.value }}</text>
                          <text [attr.x]="b.center" y="222" text-anchor="middle" font-size="13" fill="#8b93a1">{{ b.label }}</text>
                        }
                      </svg>
                    }
                    @if (c.footnote) { <span class="tr-cost__foot">{{ c.footnote }}</span> }
                  </div>
                </div>
              </section>
            }

            @if (v.findings.length) {
              <section class="tr-sec" id="tr-findings" data-sec="findings">
                <div class="tr-sh"><span class="tr-sh__n">{{ v.num['findings'] }}</span><h2 class="tr-sh__t">Findings</h2></div>
                <div class="tr-sevs">@for (s of v.severityCounts; track s.cls) { <span class="tr-pill" [attr.data-sev]="s.cls">{{ s.label }}</span> }</div>
                <div class="tr-stack">
                  @for (f of v.findings; track f.code) {
                    <article class="tr-card tr-finding">
                      <div class="tr-finding__head">
                        <span class="tr-serif tr-finding__code">{{ f.code }}</span>
                        <span class="tr-pill" [attr.data-sev]="f.severity">{{ f.severityLabel }}</span>
                        <span class="tr-top__fill"></span>
                        @if (f.meta) { <span class="tr-finding__meta">{{ f.meta }}</span> }
                      </div>
                      <div class="tr-finding__body">
                        <h3 class="tr-serif tr-finding__title">{{ f.title }}</h3>
                        @if (f.saw) { <div class="tr-block"><span class="tr-lbl">What we saw</span><p class="tr-p">{{ f.saw }}</p></div> }
                        @if (f.why) { <div class="tr-block"><span class="tr-lbl">Why it matters</span><p class="tr-p">{{ f.why }}</p></div> }
                        @if (f.assumption) { <div class="tr-block"><span class="tr-lbl">Assumption</span><p class="tr-p tr-p--assume">{{ f.assumption }}</p></div> }
                      </div>
                      @if (f.good) { <div class="tr-good"><span class="tr-lbl tr-lbl--green">What good looks like</span><p class="tr-p">{{ f.good }}</p></div> }
                    </article>
                  }
                </div>
              </section>
            }

            @if (v.plan.length) {
              <section class="tr-sec" id="tr-plan" data-sec="plan">
                <div class="tr-sh"><span class="tr-sh__n">{{ v.num['plan'] }}</span><h2 class="tr-sh__t">30-day recovery plan</h2></div>
                <div class="tr-plan">
                  <div class="tr-plan__line" aria-hidden="true"></div>
                  <div class="tr-plan__cols">
                    @for (w of v.plan; track $index) {
                      <div class="tr-plan__col">
                        <div class="tr-plan__marker"><span class="tr-plan__dot" [class.on]="w.first"></span><span class="tr-lbl tr-lbl--ink">{{ w.week }}</span></div>
                        <div class="tr-card tr-week">
                          <span class="tr-serif tr-week__t">{{ w.title }}</span>
                          <div class="tr-week__steps">@for (step of w.steps; track $index) { <span><b>—</b>{{ step }}</span> }</div>
                          @if (w.milestone) { <span class="tr-week__ms">✓ {{ w.milestone }}</span> }
                        </div>
                      </div>
                    }
                  </div>
                </div>
              </section>
            }

            @if (v.decision; as d) {
              <section class="tr-sec" id="tr-decision" data-sec="decision">
                <div class="tr-sh"><span class="tr-sh__n">{{ v.num['decision'] }}</span><h2 class="tr-sh__t">{{ v.decisionTitle }}</h2></div>
                @if (d.intro) { <p class="tr-lede">{{ d.intro }}</p> }
                <div class="tr-grid3">
                  @for (o of d.options; track $index) {
                    <div class="tr-card tr-option" [attr.data-tone]="o.tone">
                      <div class="tr-option__head"><span class="tr-serif tr-option__name">{{ o.name }}</span>@if (o.tag) { <span class="tr-pill" [attr.data-tone]="o.tone"><span class="tr-dot"></span>{{ o.tag }}</span> }</div>
                      <span class="tr-lbl">If</span>
                      <div class="tr-option__list">@for (c of o.criteria; track $index) { <span><b>○</b>{{ c }}</span> }</div>
                    </div>
                  }
                </div>
              </section>
            }

            @if (v.questions.length) {
              <section class="tr-sec" id="tr-questions" data-sec="questions">
                <div class="tr-sh"><span class="tr-sh__n">{{ v.num['questions'] }}</span><h2 class="tr-sh__t">{{ v.questionsTitle }}</h2></div>
                <div class="tr-qs">@for (q of v.questions; track q.num) { <div class="tr-q"><span class="tr-serif tr-q__n">{{ q.num }}</span><span class="tr-q__t">{{ q.text }}</span></div> }</div>
              </section>
            }

            @if (v.heard.length || v.scope) {
              <section class="tr-sec" id="tr-appendix" data-sec="appendix">
                <div class="tr-sh"><span class="tr-sh__n">A</span><h2 class="tr-sh__t">What we heard</h2></div>
                <div class="tr-heard">
                  @for (p of v.heard; track $index) { <p class="tr-p tr-p--muted">{{ p }}</p> }
                  @if (v.scope) { <div class="tr-card tr-scope"><span class="tr-lbl">Scope and method</span><p class="tr-p">{{ v.scope }}</p></div> }
                </div>
              </section>
            }

            @if (debriefUrl) {
              <div class="tr-next">
                <div><span class="tr-eyebrow tr-brass">Next step</span><span class="tr-serif tr-next__t">Walk through this report with us.</span><span class="tr-next__d">Your debrief turns these findings into a plan your team can start Monday.</span></div>
                <a class="tr-btn tr-btn--brass" [href]="debriefUrl" target="_blank" rel="noopener">Book your debrief</a>
              </div>
            }

            <footer class="tr-sign">
              <div class="tr-sign__row">
                <span class="tr-mark tr-mark--lg" aria-hidden="true">{{ v.initials }}</span>
                <div><span class="tr-sign__by">Prepared by {{ v.ownerName }}</span>@if (v.signoff) { <span class="tr-sign__line">{{ v.signoff }}</span> }</div>
              </div>
              <div class="tr-foot tr-sign__foot"><span>{{ v.confidential }}</span><span>{{ v.reportId }}</span></div>
            </footer>
          }
        </main>
      </div>
    </div>
    }
  `,
  styles: [`
    :host { display: block; }
    .tr { --paper: #faf8f4; --card: #fff; --card-border: #ebe7de; --rule: #e7e3da; --ink: #10161f; --body: #2b333f; --muted: #5b6472; --faint: #8b93a1;
      --navy: #0d1b2e; --brass: #b08d57; --brass-navy: #c9a36a;
      background: var(--paper); color: var(--ink); font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; min-height: 100vh; }
    .tr--embedded { min-height: 0; border-radius: 16px; overflow: hidden; border: 1px solid var(--rule); }
    .tr-serif { font-family: "Newsreader", Georgia, "Times New Roman", serif; }
    .tr-top { display: flex; align-items: center; gap: 14px; padding: 20px 56px; background: var(--card); border-bottom: 1px solid var(--rule); }
    .tr-top__name { font-size: 17px; font-weight: 700; letter-spacing: -0.01em; }
    .tr-top__product { color: var(--faint); font-weight: 600; }
    .tr-top__fill { flex: 1; }
    .tr-mark { flex: none; width: 40px; height: 40px; border-radius: 10px; background: var(--navy); color: #fff; display: grid; place-items: center; font-size: 15px; font-weight: 700; letter-spacing: .02em; }
    .tr-mark--light { background: #fff; color: var(--navy); }
    .tr-mark--lg { width: 44px; height: 44px; }
    .tr-btn { height: 44px; padding: 0 22px; border-radius: 999px; font: 700 15px/1 "Helvetica Neue", Helvetica, Arial, sans-serif; display: inline-flex; align-items: center; justify-content: center; gap: 8px; white-space: nowrap; border: 0; cursor: pointer; text-decoration: none; }
    .tr-btn--primary { background: var(--navy); color: #fff; }
    .tr-btn--ghost { background: #fff; color: var(--ink); box-shadow: inset 0 0 0 1px #d9d4c8; }
    .tr-btn--brass { background: var(--brass-navy); color: var(--navy); height: 52px; padding: 0 28px; font-size: 16px; }
    .tr-btn--sm { height: 38px; font-size: 14px; }
    .tr-btn--lg { height: 54px; padding: 0 30px; font-size: 17px; }
    .tr-btn:disabled { opacity: .6; cursor: default; }
    .tr-narrow { display: none; }
    .tr-cover { background: var(--navy); color: #fff; position: relative; overflow: hidden; padding: 72px 56px 40px; }
    .tr-cover::before { content: ""; position: absolute; inset: 0; background: radial-gradient(60% 80% at 100% 0%, #1d3a5f 0%, rgba(13,27,46,0) 70%); }
    .tr-cover__in { position: relative; display: flex; flex-direction: column; gap: 22px; }
    .tr-eyebrow { font-size: 12px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
    .tr-brass { color: var(--brass-navy); }
    .tr-brass-ink { color: var(--brass); }
    .tr-cover__client { margin: 0; font-size: 96px; font-weight: 500; letter-spacing: -0.025em; line-height: .95; }
    .tr-cover__project { font-size: 22px; color: #b9c6d8; }
    .tr-meta { display: flex; margin-top: 34px; border-top: 1px solid rgba(255,255,255,.14); }
    .tr-meta > div { flex: 1; padding: 22px 16px 0 0; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
    .tr-meta span:first-child { font-size: 11px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: #8ea0b8; }
    .tr-meta span:last-child { font-size: 16px; font-weight: 600; color: #fff; overflow-wrap: anywhere; }
    .tr-body { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 56px; padding: 0 56px 56px; }
    .tr--embedded .tr-body { grid-template-columns: minmax(0, 1fr); padding: 0 32px 40px; }
    .tr--embedded .tr-nav { display: none; }
    .tr-nav { padding-top: 64px; }
    .tr-nav__in { position: sticky; top: 20px; }
    .tr-toc { display: flex; flex-direction: column; gap: 2px; }
    .tr-toc button { display: flex; gap: 12px; padding: 9px 12px; border-radius: 10px; font: 600 14px/1.3 "Helvetica Neue", Helvetica, Arial, sans-serif; color: var(--muted); background: none; border: 0; cursor: pointer; text-align: left; }
    .tr-toc button b { font-family: "Newsreader", Georgia, serif; font-weight: 500; color: var(--brass); width: 20px; flex: none; }
    .tr-toc button.on { background: #fff; color: var(--ink); box-shadow: inset 0 0 0 1px var(--card-border); }
    .tr-navcard { margin-top: 22px; padding: 16px; border-radius: 14px; background: #fff; box-shadow: inset 0 0 0 1px var(--card-border); display: flex; flex-direction: column; gap: 10px; }
    .tr-navcard__text { font-size: 14px; line-height: 1.45; font-weight: 600; }
    .tr-main { max-width: 880px; min-width: 0; }
    .tr-sec { display: flex; flex-direction: column; gap: 22px; padding-top: 64px; scroll-margin-top: 12px; }
    .tr-sh { display: flex; align-items: baseline; gap: 16px; padding-bottom: 16px; border-bottom: 1px solid var(--rule); }
    .tr-sh__n { font-family: "Newsreader", Georgia, serif; font-size: 20px; color: var(--brass); font-weight: 500; }
    .tr-sh__t { margin: 0; font-family: "Newsreader", Georgia, serif; font-size: 38px; font-weight: 500; letter-spacing: -0.015em; line-height: 1.1; }
    .tr-lede { margin: 0; font-size: 17px; line-height: 1.6; color: var(--muted); }
    .tr-card { background: var(--card); border-radius: 16px; border: 1px solid var(--card-border); }
    .tr-pill { display: inline-flex; align-items: center; gap: 7px; height: 28px; padding: 0 12px; border-radius: 999px; font-size: 12px; font-weight: 700; letter-spacing: .04em; white-space: nowrap; text-transform: uppercase; background: #eef1f6; color: #3d4b63; }
    .tr-dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
    .tr-pill[data-tone="r"], .tr-pill[data-sev="critical"] { background: #fdecea; color: #b42318; }
    .tr-pill[data-tone="a"], .tr-pill[data-sev="high"] { background: #fdf1dc; color: #9a5b00; }
    .tr-pill[data-tone="g"] { background: #e3f4e8; color: #17703a; }
    .tr-pill[data-tone="r"] .tr-dot { background: #d64545; } .tr-pill[data-tone="a"] .tr-dot { background: #e0a100; } .tr-pill[data-tone="g"] .tr-dot { background: #2f9e5b; }
    .tr-lbl { font-size: 11px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--faint); }
    .tr-lbl--gap { margin-top: 10px; }
    .tr-lbl--green { color: #17703a; }
    .tr-lbl--ink { color: var(--ink); }
    .tr-p { margin: 0; font-size: 16px; line-height: 1.65; color: var(--body); white-space: pre-line; }
    .tr-p--assume { font-style: italic; color: var(--muted); }
    .tr-p--muted { font-size: 15px; color: var(--muted); }
    .tr-status { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .tr-status__note { font-size: 15px; font-weight: 600; color: var(--muted); }
    .tr-quote { margin: 0; font-size: 34px; line-height: 1.28; letter-spacing: -0.01em; font-weight: 400; padding-left: 26px; border-left: 3px solid var(--brass); }
    .tr-actions, .tr-stack { display: flex; flex-direction: column; gap: 12px; }
    .tr-stack { gap: 16px; }
    .tr-action { display: grid; grid-template-columns: 44px minmax(0, 1fr); gap: 18px; padding: 22px 24px; }
    .tr-action__n { width: 44px; height: 44px; border-radius: 50%; background: var(--navy); color: #fff; display: grid; place-items: center; font-size: 22px; }
    .tr-action > div { display: flex; flex-direction: column; gap: 6px; }
    .tr-action__t { font-size: 18px; font-weight: 700; line-height: 1.3; }
    .tr-action__d { font-size: 15px; line-height: 1.5; color: var(--muted); }
    .tr-grid2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .tr-grid3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .tr-tile { padding: 22px; display: flex; flex-direction: column; gap: 12px; }
    .tr-tile__head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .tr-tile__area { font-size: 16px; font-weight: 700; }
    .tr-tile__note { font-size: 14px; line-height: 1.5; color: var(--muted); }
    .tr-segs { display: flex; gap: 4px; }
    .tr-segs span { flex: 1; height: 6px; border-radius: 3px; background: #ece8df; }
    .tr-segs[data-tone="r"] span.on { background: #d64545; } .tr-segs[data-tone="a"] span.on { background: #e0a100; } .tr-segs[data-tone="g"] span.on { background: #2f9e5b; }
    .tr-legend { display: flex; gap: 18px; flex-wrap: wrap; font-size: 13px; color: var(--faint); }
    .tr-legend > span { display: flex; align-items: center; gap: 6px; }
    .tr-legend__dot { width: 10px; height: 10px; border-radius: 50%; }
    .tr-legend__dot[data-tone="r"] { background: #d64545; } .tr-legend__dot[data-tone="a"] { background: #e0a100; } .tr-legend__dot[data-tone="g"] { background: #2f9e5b; }
    .tr-cost { padding: 30px; display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 36px; align-items: end; }
    .tr-cost__stats { display: flex; flex-direction: column; gap: 18px; }
    .tr-cost__stats > div { display: flex; flex-direction: column; gap: 6px; padding: 4px 0 18px; border-bottom: 1px solid var(--card-border); }
    .tr-cost__big { font-size: 46px; font-weight: 500; letter-spacing: -0.02em; line-height: 1; }
    .tr-cost__lbl { font-size: 14px; color: var(--muted); line-height: 1.4; }
    .tr-cost__chart { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
    .tr-cost__head { font-size: 20px; font-weight: 700; line-height: 1.3; }
    .tr-cost__svg { display: block; width: 100%; max-width: 420px; height: auto; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; }
    .tr-cost__foot { font-size: 12px; color: var(--faint); }
    .tr-sevs { display: flex; gap: 8px; flex-wrap: wrap; }
    .tr-finding { overflow: hidden; }
    .tr-finding__head { display: flex; align-items: center; gap: 14px; padding: 22px 26px 0; flex-wrap: wrap; }
    .tr-finding__code { font-size: 18px; color: var(--brass); }
    .tr-finding__meta { font-size: 13px; font-weight: 600; color: var(--faint); }
    .tr-finding__body { padding: 12px 26px 22px; display: flex; flex-direction: column; gap: 16px; }
    .tr-finding__title { margin: 0; font-size: 27px; font-weight: 500; letter-spacing: -0.01em; line-height: 1.2; }
    .tr-block { display: flex; flex-direction: column; gap: 6px; }
    .tr-good { padding: 18px 26px 22px; background: #f4f8f4; border-top: 1px solid #e3ede5; display: flex; flex-direction: column; gap: 6px; }
    .tr-plan { position: relative; }
    .tr-plan__line { position: absolute; left: 7px; right: 0; top: 7px; height: 2px; background: #d9d4c8; }
    .tr-plan__cols { position: relative; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
    .tr-plan__col { display: flex; flex-direction: column; gap: 14px; }
    .tr-plan__marker { display: flex; align-items: center; gap: 10px; }
    .tr-plan__dot { width: 14px; height: 14px; border-radius: 50%; background: #fff; box-shadow: inset 0 0 0 3px var(--navy); flex: none; }
    .tr-plan__dot.on { background: var(--navy); }
    .tr-week { padding: 20px; display: flex; flex-direction: column; gap: 12px; flex: 1; }
    .tr-week__t { font-size: 22px; font-weight: 500; line-height: 1.15; }
    .tr-week__steps { display: flex; flex-direction: column; gap: 8px; }
    .tr-week__steps span { display: grid; grid-template-columns: 14px minmax(0, 1fr); gap: 8px; font-size: 14px; line-height: 1.45; color: var(--body); }
    .tr-week__steps b { color: var(--brass); font-weight: 400; }
    .tr-week__ms { margin-top: auto; padding-top: 12px; border-top: 1px solid var(--card-border); font-size: 13px; font-weight: 700; color: #17703a; }
    .tr-option { padding: 22px; display: flex; flex-direction: column; gap: 14px; border-top: 3px solid #e0a100; }
    .tr-option[data-tone="g"] { border-top-color: #2f9e5b; } .tr-option[data-tone="r"] { border-top-color: #d64545; }
    .tr-option__head { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
    .tr-option__name { font-size: 28px; font-weight: 500; }
    .tr-option__list { display: flex; flex-direction: column; gap: 10px; }
    .tr-option__list span { display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 8px; font-size: 14px; line-height: 1.45; }
    .tr-option__list b { color: var(--faint); font-weight: 400; }
    .tr-q { display: grid; grid-template-columns: 40px minmax(0, 1fr); gap: 14px; padding: 16px 0; border-bottom: 1px solid var(--card-border); }
    .tr-q__n { font-size: 22px; color: var(--brass); }
    .tr-q__t { font-size: 17px; line-height: 1.5; font-weight: 600; }
    .tr-heard { display: flex; flex-direction: column; gap: 14px; }
    .tr-scope { padding: 20px 22px; display: flex; flex-direction: column; gap: 6px; background: #f6f3ec; }
    .tr-scope .tr-p { font-size: 15px; }
    .tr-next { margin-top: 64px; padding: 36px; border-radius: 20px; background: var(--navy); color: #fff; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 30px; align-items: center; }
    .tr-next > div { display: flex; flex-direction: column; gap: 10px; }
    .tr-next__t { font-size: 32px; font-weight: 500; line-height: 1.15; }
    .tr-next__d { font-size: 15px; line-height: 1.55; color: #b9c6d8; }
    .tr-sign { margin-top: 28px; padding-top: 24px; border-top: 1px solid var(--rule); }
    .tr-sign__row { display: flex; align-items: center; gap: 16px; }
    .tr-sign__row > div { display: flex; flex-direction: column; gap: 3px; }
    .tr-sign__by { font-size: 15px; font-weight: 700; }
    .tr-sign__line { font-size: 13px; color: var(--faint); }
    .tr-foot { display: flex; justify-content: space-between; gap: 16px; font-size: 12px; color: var(--faint); letter-spacing: .04em; text-transform: uppercase; }
    .tr-sign__foot { margin-top: 28px; }
    .tr-locked { position: relative; padding-top: 64px; min-height: 560px; }
    .tr-locked__blur { filter: blur(6px); opacity: .55; pointer-events: none; max-height: 520px; overflow: hidden; display: flex; flex-direction: column; gap: 22px; user-select: none; }
    .tr-ph { display: block; height: 12px; border-radius: 6px; background: #e3ded3; }
    .tr-ph--pill { width: 84px; height: 28px; border-radius: 999px; background: #f0e2c6; }
    .tr-locked .tr-segs span.on { background: #e0a100; }
    .tr-unlock { position: absolute; inset: 104px 0 auto 0; display: flex; justify-content: center; }
    .tr-unlock__card { width: min(620px, 100%); box-sizing: border-box; padding: 36px; display: flex; flex-direction: column; gap: 16px; box-shadow: 0 30px 80px rgba(13,27,46,.22); }
    .tr-unlock__title { font-size: 34px; font-weight: 500; line-height: 1.15; }
    .tr-unlock__list { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 18px; }
    .tr-unlock__list span { font-size: 15px; display: flex; gap: 8px; }
    .tr-unlock__list b { color: #17703a; }
    .tr-unlock__row { display: flex; align-items: center; gap: 18px; margin-top: 8px; flex-wrap: wrap; }
    .tr-unlock__note { font-size: 13px; color: var(--muted); line-height: 1.4; }
    .tr-error { margin: 0; color: #b42318; font-weight: 600; font-size: 14px; }
    .tr-pdfcover { display: none; }

    @media (max-width: 760px) {
      .tr-top { padding: 14px 20px; gap: 10px; }
      .tr-top__name { font-size: 15px; display: flex; flex-direction: column; line-height: 1.2; }
      .tr-top__name > span:first-child { display: block; }
      .tr-wide { display: none; }
      .tr-narrow { display: inline; }
      .tr-btn--ghost { height: 38px; padding: 0 16px; font-size: 14px; }
      .tr-cover { padding: 44px 20px 28px; }
      .tr-cover__client { font-size: 52px; }
      .tr-cover__project { font-size: 18px; }
      .tr-meta { display: grid; grid-template-columns: 1fr 1fr; margin-top: 18px; }
      .tr-meta > div { padding-top: 16px; }
      .tr-body, .tr--embedded .tr-body { grid-template-columns: minmax(0, 1fr); gap: 0; padding: 0 20px 40px; }
      .tr-nav { display: none; }
      .tr-sec { padding-top: 48px; }
      .tr-sh__t { font-size: 28px; }
      .tr-quote { font-size: 26px; padding-left: 18px; }
      .tr-action { padding: 18px; gap: 14px; }
      .tr-grid2, .tr-grid3, .tr-plan__cols, .tr-cost, .tr-unlock__list { grid-template-columns: minmax(0, 1fr); }
      .tr-plan__line { display: none; }
      .tr-cost { padding: 22px; gap: 24px; }
      .tr-finding__head { padding: 18px 18px 0; }
      .tr-finding__body { padding: 10px 18px 18px; }
      .tr-good { padding: 16px 18px 18px; }
      .tr-finding__title { font-size: 23px; }
      .tr-next { grid-template-columns: minmax(0, 1fr); padding: 26px; }
      .tr-unlock { inset: 72px 0 auto 0; }
      .tr-unlock__card { padding: 24px; }
      .tr-unlock__title { font-size: 28px; }
      .tr-locked { min-height: 640px; }
    }

    @media print {
      .tr { background: #fff; min-height: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .tr-top, .tr-nav, .tr-next, .tr-cover, .tr-locked { display: none !important; }
      .tr-pdfcover { display: block; page: cover; width: 8.5in; height: 11in; background: var(--navy); color: #fff; position: relative; break-after: page; overflow: hidden; }
      .tr-pdfcover::before { content: ""; position: absolute; inset: 0; background: radial-gradient(70% 60% at 100% 0%, #1d3a5f 0%, rgba(13,27,46,0) 70%); }
      .tr-pdfcover__in { position: relative; height: 100%; box-sizing: border-box; padding: 64px 64px 56px; display: flex; flex-direction: column; }
      .tr-pdfcover__brand { display: flex; align-items: center; gap: 12px; font-size: 16px; font-weight: 700; }
      .tr-pdfcover__body { margin-top: auto; display: flex; flex-direction: column; gap: 22px; }
      .tr-pdfcover__client { font-size: 84px; font-weight: 500; letter-spacing: -0.025em; line-height: .95; }
      .tr-pdfcover__project { font-size: 20px; color: #b9c6d8; }
      .tr-pdfcover__rule { width: 80px; height: 2px; background: var(--brass-navy); margin: 18px 0 8px; }
      .tr-pdfcover__meta { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
      .tr-pdfcover__meta > div { display: flex; flex-direction: column; gap: 5px; }
      .tr-pdfcover__meta span:first-child { font-size: 10px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: #8ea0b8; }
      .tr-pdfcover__meta span:last-child { font-size: 15px; font-weight: 600; }
      .tr-pdfcover__foot { margin-top: 56px; color: #8ea0b8; }
      .tr-body { display: block; padding: 0; }
      .tr-main { max-width: none; zoom: .8; }
      .tr-sec { padding-top: 36px; }
      .tr-sec:first-child { padding-top: 0; }
      .tr-sh { break-after: avoid; }
      .tr-card, .tr-q, .tr-plan__col, .tr-status, .tr-quote, .tr-legend { break-inside: avoid; }
      .tr-plan__cols { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .tr-plan__line { display: none; }
      .tr-sign { break-inside: avoid; }
    }
  `],
} )
export class TechReportComponent implements OnChanges, AfterViewInit {
  @Input() view: ReportView | null = null;
  @Input() debriefUrl = '';
  @Input() busy = false;
  @Input() error = '';
  /** Inside Pulse > Reports: no contents rail, no print rules. */
  @Input() embedded = false;
  @Output() readonly unlock = new EventEmitter<void>();

  readonly active = signal( 'verdict' );
  readonly placeholders = [0, 1, 2, 3, 4, 5];

  private readonly host = inject( ElementRef<HTMLElement> );
  private observer: IntersectionObserver | null = null;
  private printStyle: HTMLStyleElement | null = null;

  constructor () {
    inject( DestroyRef ).onDestroy( () => {
      this.observer?.disconnect();
      this.printStyle?.remove();
    } );
  }

  ngOnChanges (): void {
    if ( !this.embedded ) this.setPrintRules();
    // Sections may have changed (preview -> released): watch the new ones.
    if ( this.observer ) queueMicrotask( () => this.watchSections() );
  }

  ngAfterViewInit (): void {
    if ( this.embedded || typeof IntersectionObserver === 'undefined' ) return;
    this.observer = new IntersectionObserver( ( entries ) => {
      const visible = entries.filter( ( entry ) => entry.isIntersecting ).sort( ( a, b ) => a.boundingClientRect.top - b.boundingClientRect.top );
      const id = visible[0]?.target.getAttribute( 'data-sec' );
      if ( id ) this.active.set( id );
    }, { rootMargin: '-10% 0px -70% 0px' } );
    this.watchSections();
  }

  private watchSections (): void {
    if ( !this.observer ) return;
    this.observer.disconnect();
    this.host.nativeElement.querySelectorAll( '[data-sec]' ).forEach( ( el: Element ) => this.observer!.observe( el ) );
  }

  go ( id: string ): void {
    this.active.set( id );
    this.host.nativeElement.querySelector( `#tr-${id}` )?.scrollIntoView( { behavior: 'smooth', block: 'start' } );
  }

  print (): void {
    window.print();
  }

  /**
   * The running header and footer ("{OWNER} · {PRODUCT}" / client, then
   * "CONFIDENTIAL · {reportId}" / page number). CSS can't read them from the
   * page, so they're written into @page rules for this report. The cover is
   * its own named page (@page cover) with no margins and no header: Chrome
   * lays every page out at the default page's width, so ":first" alone
   * can't make it full-bleed. Nothing may come before the cover, or Chrome
   * starts with a blank default page: the empty <router-outlet> is hidden
   * and the body margin zeroed for print.
   */
  private setPrintRules (): void {
    const v = this.view;
    if ( !v || typeof document === 'undefined' ) return;
    const css = ( value: string ) => JSON.stringify( value ).replace( /</g, '\\3C ' );
    const box = 'font: 700 8pt "Helvetica Neue", Helvetica, Arial, sans-serif; letter-spacing: .14em; color: #8b93a1;';
    const rules = `
      @page { size: letter; margin: 0.8in 0.75in 0.75in;
        @top-left { content: ${css( v.printHeaderLeft )}; ${box} }
        @top-right { content: ${css( v.printHeaderRight )}; ${box} }
        @bottom-left { content: ${css( v.printFooterLeft )}; ${box} }
        @bottom-right { content: counter(page); ${box} } }
      @page cover { margin: 0;
        @top-left { content: none; } @top-right { content: none; } @bottom-left { content: none; } @bottom-right { content: none; } }
      @media print { html, body { background: #fff !important; margin: 0 !important; } router-outlet { display: none; } app-root { display: block; } }`;
    if ( !this.printStyle ) {
      this.printStyle = document.createElement( 'style' );
      this.printStyle.setAttribute( 'data-tech-report-print', '' );
      document.head.appendChild( this.printStyle );
    }
    this.printStyle.textContent = rules;
  }
}
