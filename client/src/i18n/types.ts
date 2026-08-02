import ar from "./ar";

// `ar` uses `as const` so keys/nesting are exact literal types (catches typos
// and structural mismatches in ku.ts) — but plain string leaves must widen to
// `string`, otherwise ku.ts would be forced to contain the same Arabic text.
// Function-valued leaves (interpolated strings) are left untouched since their
// inferred return type is already `string`, not a literal.
type Widen<T> = T extends (...args: any[]) => any
  ? T
  : T extends string
  ? string
  : { [K in keyof T]: Widen<T[K]> };

export type TranslationKeys = Widen<typeof ar>;
