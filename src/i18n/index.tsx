import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Locale = "zh-CN" | "en";

export type MessageDescriptor = {
  zh: string;
  en: string;
};

type TranslationValues = Record<string, string | number>;

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

const STORAGE_KEY = "cyber-company.locale";

const I18nContext = createContext<I18nContextValue | null>(null);

function isLocale(value: string | null): value is Locale {
  return value === "zh-CN" || value === "en";
}

function resolveInitialLocale(): Locale {
  if (typeof window === "undefined") {
    return "zh-CN";
  }

  const savedLocale = window.localStorage.getItem(STORAGE_KEY);
  if (isLocale(savedLocale)) {
    return savedLocale;
  }

  return window.navigator.language.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}

function formatMessage(template: string, values?: TranslationValues) {
  if (!values) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(resolveInitialLocale);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, locale);
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
    }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}

export function useTranslate() {
  const { locale } = useI18n();

  return (message: MessageDescriptor, values?: TranslationValues) =>
    formatMessage(locale === "en" ? message.en : message.zh, values);
}

export function defineMessage(zh: string, en: string): MessageDescriptor {
  return { zh, en };
}
