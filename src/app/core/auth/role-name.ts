import type { StaffRoleRef } from '../api/models';

/** A role's name in the UI language; English falls back to Arabic (the API keeps both raw on admin routes). */
export function roleName(role: Pick<StaffRoleRef, 'nameAr' | 'nameEn'>, lang: 'ar' | 'en'): string {
  return (lang === 'en' && role.nameEn?.trim()) || role.nameAr;
}
