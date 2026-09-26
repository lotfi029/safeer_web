import type { ar } from './ar';

type DeepStrings<T> = { [K in keyof T]: T[K] extends string ? string : DeepStrings<T[K]> };

/** The shape every locale dictionary must have (Arabic is the source of truth). */
export type Translation = DeepStrings<typeof ar>;
