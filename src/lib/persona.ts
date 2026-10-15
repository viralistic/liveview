import type { User } from '../data/types';
import { PERSONAS, personaById, type Capability, type NavId, type Persona } from '../data/personas';
import { orgOfUser } from '../data/orgs';

export function personaOf(user: User): Persona {
  return personaById(user.persona);
}
export function can(user: User, cap: Capability): boolean {
  return personaOf(user).capabilities.includes(cap);
}
export function hasNav(user: User, nav: NavId): boolean {
  return personaOf(user).nav.includes(nav);
}
/** One line under a name: persona at organization. */
export function roleLine(user: User): string {
  return `${personaOf(user).short} · ${orgOfUser(user).shortName}`;
}
/** Group users by organization kind for the switcher. */
export function personaGroups(users: User[]): { kind: Persona['org']; label: string; users: User[] }[] {
  const groups: { kind: Persona['org']; label: string; users: User[] }[] = [
    { kind: 'vendor', label: 'n8n', users: [] },
    { kind: 'partner', label: 'Viralistic · partner', users: [] },
    { kind: 'client', label: 'Clients', users: [] },
  ];
  for (const u of users) {
    const org = personaOf(u).org;
    groups.find((g) => g.kind === org)!.users.push(u);
  }
  return groups.filter((g) => g.users.length);
}
export { PERSONAS };
