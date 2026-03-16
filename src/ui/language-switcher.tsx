import { Languages } from "lucide-react";
import { useI18n, useTranslate, type Locale } from "../i18n";

const LOCALES: Array<{ id: Locale; label: string }> = [
  { id: "zh-CN", label: "中" },
  { id: "en", label: "EN" },
];

type LanguageSwitcherProps = {
  compact?: boolean;
  className?: string;
};

export function LanguageSwitcher({ compact = false, className = "" }: LanguageSwitcherProps) {
  const { locale, setLocale } = useI18n();
  const t = useTranslate();

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full border border-border/80 bg-background/90 p-1 text-xs shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/70 ${className}`.trim()}
      aria-label={t(defineMessages.groupLabel)}
      role="group"
    >
      <span className={`inline-flex items-center text-muted-foreground ${compact ? "px-1.5" : "px-2"}`}>
        <Languages className="h-3.5 w-3.5" />
        {!compact ? <span className="ml-1">{t(defineMessages.label)}</span> : null}
      </span>
      {LOCALES.map((option) => {
        const active = option.id === locale;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => setLocale(option.id)}
            className={`rounded-full px-2.5 py-1 font-semibold transition-colors ${
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            aria-pressed={active}
            aria-label={t(defineMessages.optionLabel, { language: option.id === "en" ? "English" : "中文" })}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

const defineMessages = {
  label: {
    zh: "语言",
    en: "Language",
  },
  groupLabel: {
    zh: "语言切换",
    en: "Language switcher",
  },
  optionLabel: {
    zh: "切换到 {language}",
    en: "Switch to {language}",
  },
};
