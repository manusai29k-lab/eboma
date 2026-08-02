import { useLanguage } from "@/contexts/LanguageContext";
import { LANGUAGES } from "@/i18n";

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { language, setLanguage } = useLanguage();

  return (
    <div className={`inline-flex items-center rounded-full bg-white/5 border border-white/10 p-0.5 text-xs ${className}`}>
      {LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          type="button"
          onClick={() => setLanguage(lang.code)}
          className={`px-2.5 py-1 rounded-full transition-colors ${
            language === lang.code ? "bg-violet-600 text-white" : "text-white/50 hover:text-white"
          }`}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
}
