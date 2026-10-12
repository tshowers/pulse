import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * The public marketing pages are prerendered to real HTML at build time so
 * crawlers and link previews (Slack, iMessage, LinkedIn - none of which run
 * JavaScript) see each page's own content, title and description. Everything
 * else is signed-in or per-survey and keeps rendering in the browser only;
 * Firebase Hosting serves those from index.csr.html (see firebase.json).
 * Keep this list in step with public/sitemap.xml.
 */
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'about', renderMode: RenderMode.Prerender },
  { path: 'help', renderMode: RenderMode.Prerender },
  { path: 'ios', renderMode: RenderMode.Prerender },
  { path: 'support', renderMode: RenderMode.Prerender },
  { path: 'pricing', renderMode: RenderMode.Prerender },
  { path: '**', renderMode: RenderMode.Client },
];
