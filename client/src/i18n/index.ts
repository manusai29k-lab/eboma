import ar from "./ar";
import ku from "./ku";

export type { Language } from "./config";
export type { TranslationKeys } from "./types";
export { LANGUAGE_STORAGE_KEY, DEFAULT_LANGUAGE, LANGUAGES } from "./config";

export const translations = { ar, ku } as const;
