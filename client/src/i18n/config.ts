export type Language = "ar" | "ku";

export const LANGUAGE_STORAGE_KEY = "eboma-language";

export const DEFAULT_LANGUAGE: Language = "ar";

export const LANGUAGES: { code: Language; label: string }[] = [
  { code: "ar", label: "عربي" },
  { code: "ku", label: "کوردی" },
];
