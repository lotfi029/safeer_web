/** Locale-agnostic paths of the «من نحن» pages (prefix with `LocaleService.link()`). */
export const ABOUT_PATHS = {
  about: '/about',
  orgStructure: '/about/org-structure',
} as const;

/** One entry of a header dropdown / drawer group (governance sections, the «من نحن» pages). */
export interface NavMenuLink {
  key: string;
  /** API name, or null when `labelKey` (a translation key) names the entry. */
  label: string | null;
  labelKey: string | null;
  path: string;
  /** Active only on exactly this path (the about page must not light up on its sub-pages). */
  exact?: boolean;
}

/** The «من نحن» dropdown: the about page itself, then the organisational structure. */
export function aboutLinks(): NavMenuLink[] {
  return [
    {
      key: 'about',
      label: null,
      labelKey: 'shell.aboutLink',
      path: ABOUT_PATHS.about,
      exact: true,
    },
    {
      key: 'org-structure',
      label: null,
      labelKey: 'shell.orgStructure',
      path: ABOUT_PATHS.orgStructure,
    },
  ];
}
