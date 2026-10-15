import type { Org, OrgKind, User } from './types';
import { COMPANIES } from './companies';

/**
 * Three kinds of organization meet in LiveView.
 * The vendor (n8n) is involved in every instance below, through the partner
 * program (partner route) or an enterprise agreement (local host).
 */
export const VENDOR: Org = { id: 'n8n', kind: 'vendor', name: 'n8n GmbH', shortName: 'n8n', initials: 'N8', city: 'Berlin' };
export const PARTNER: Org = { id: 'viralistic', kind: 'partner', name: 'Viralistic Digital Agency Amsterdam', shortName: 'Viralistic', initials: 'VI', city: 'Amsterdam' };

export const ORGS: Org[] = [
  VENDOR,
  PARTNER,
  ...COMPANIES.filter((c) => c.id !== 'viralistic').map<Org>((c) => ({ id: c.id, kind: 'client', name: c.name, shortName: c.shortName, initials: c.initials, city: c.city })),
];

export const orgById = (id: string): Org => ORGS.find((o) => o.id === id) ?? PARTNER;
export const orgOfUser = (u: Pick<User, 'companyId'>): Org => orgById(u.companyId);
export const ORG_KIND_LABEL: Record<OrgKind, string> = { vendor: 'n8n', partner: 'n8n partner', client: 'Client' };
