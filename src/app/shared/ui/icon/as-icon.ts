import { ICON_NAMES, type IconName } from './icon-names';

const KNOWN: ReadonlySet<string> = new Set(ICON_NAMES);

/** API icon names are free strings; unknown ones fall back to a neutral icon. */
export function asIcon(name: string | null | undefined, fallback: IconName = 'sparkles'): IconName {
  return name && KNOWN.has(name) ? (name as IconName) : fallback;
}
