import { DOCUMENT } from '@angular/common';
import { EnvironmentProviders, inject, provideEnvironmentInitializer } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

/** A route's `data: { meta }` - its own title and search/link-preview description. */
export interface PageMeta {
  title: string;
  description: string;
  /** Leave the Open Graph / Twitter tags as index.html has them (the home
   *  page, whose link preview is the product's card). */
  keepSocial?: boolean;
}

const TAGS = {
  socialDescription: [ 'property="og:description"', 'name="twitter:description"' ],
  title: [ 'property="og:title"', 'name="twitter:title"' ],
};

/**
 * Gives each public page its own <title>, description and Open Graph /
 * Twitter tags from its route's `data.meta`. Runs while pages prerender
 * (app.routes.server.ts), so the static HTML that crawlers and link
 * previews read carries the right text, and again on every navigation in
 * the browser. Routes without `meta` go back to index.html's own tags;
 * components that set a title in ngOnInit (pricing, profile) still win,
 * since that runs after NavigationEnd.
 */
export function providePageMeta (): EnvironmentProviders {
  return provideEnvironmentInitializer( () => {
    const document = inject( DOCUMENT );
    const router = inject( Router );
    const title = inject( Title );
    const meta = inject( Meta );

    const defaults: PageMeta = {
      title: title.getTitle(),
      description: meta.getTag( 'name="description"' )?.content ?? '',
    };
    // The link-preview copy is the line on the product's card, not the
    // search description, so it has its own defaults.
    const defaultSocialTitle = meta.getTag( TAGS.title[0] )?.content ?? defaults.title;
    const defaultSocialDescription = meta.getTag( TAGS.socialDescription[0] )?.content ?? defaults.description;

    router.events
      .pipe( filter( ( event ): event is NavigationEnd => event instanceof NavigationEnd ) )
      .subscribe( () => {
        const page = deepest( router.routerState.snapshot.root ).data['meta'] as PageMeta | undefined;
        const social = page && !page.keepSocial ? page : undefined;
        const socialTitle = social ? social.title.replace( / \| 16Ahead$/, '' ) : defaultSocialTitle;

        title.setTitle( page?.title ?? defaults.title );
        setContent( 'name="description"', page?.description ?? defaults.description );
        TAGS.socialDescription.forEach( ( selector ) => setContent( selector, social?.description ?? defaultSocialDescription ) );
        TAGS.title.forEach( ( selector ) => setContent( selector, socialTitle ) );

        // og:url follows the canonical link that provideCanonicalUrl() keeps current.
        const canonical = document.querySelector( 'link[rel="canonical"]' )?.getAttribute( 'href' );
        if ( canonical ) setContent( 'property="og:url"', canonical );
      } );

    function setContent ( selector: string, content: string ): void {
      const tag = meta.getTag( selector );
      if ( tag ) tag.setAttribute( 'content', content );
    }
  } );
}

function deepest ( route: ActivatedRouteSnapshot ): ActivatedRouteSnapshot {
  let current = route;
  while ( current.firstChild ) current = current.firstChild;
  return current;
}
