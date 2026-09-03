import { Injectable } from '@angular/core';
import { collection, doc, getDoc, getFirestore } from 'firebase/firestore';
import { Product } from '../models/product.model';

export interface PulseTenantContact {
  id: string;
  company?: {
    products?: Product[];
  };
}

/**
 * Minimal Firestore-direct data layer, scoped to the one thing
 * PulsePricingComponent needs: a tenant's own contact record, to read any
 * per-tenant custom pricing override stored on `company.products`. Same
 * collection path convention as Network's NetworkDataService.getContact
 * (`tenants/{tenantId}/contacts/{contactId}`) - trimmed even further than
 * that, since Pulse doesn't need Network's other contact CRUD methods.
 */
@Injectable( { providedIn: 'root' } )
export class PulseDataService {
  private get firestore () {
    return getFirestore();
  }

  private contactsRef ( tenantId: string ) {
    return collection( this.firestore, `tenants/${tenantId}/contacts` );
  }

  /** Mirrors DataService.getContactFullByIdOnce(contactId, user). */
  async getContact ( tenantId: string, contactId: string ): Promise<PulseTenantContact | null> {
    if ( !contactId ) return null;
    const snap = await getDoc( doc( this.contactsRef( tenantId ), contactId ) );
    return snap.exists() ? ( { id: snap.id, ...( snap.data() as any ) } as PulseTenantContact ) : null;
  }
}
