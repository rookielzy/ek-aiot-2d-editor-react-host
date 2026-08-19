import { ConfigProvider } from "antd";
import enUS from "antd/locale/en_US";
import zhCN from "antd/locale/zh_CN";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { EN_US_MESSAGES, type MessageKey, ZH_CN_MESSAGES } from "./messages";

export const LANGUAGE_STORAGE_KEY = "ek-aiot.host-locale";

export type AppLocale = "zh-CN" | "en-US";

interface LanguageContextValue {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  t: (key: MessageKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const messagesByLocale = {
  "zh-CN": ZH_CN_MESSAGES,
  "en-US": EN_US_MESSAGES,
} satisfies Record<AppLocale, Record<MessageKey, string>>;

const antdLocaleByAppLocale = {
  "zh-CN": zhCN,
  "en-US": enUS,
} satisfies Record<AppLocale, typeof zhCN>;

function isAppLocale(value: string | null): value is AppLocale {
  return value === "zh-CN" || value === "en-US";
}

function resolveInitialLocale(): AppLocale {
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (isAppLocale(stored)) return stored;
  return "zh-CN";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<AppLocale>(resolveInitialLocale);

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, locale);
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key) => messagesByLocale[locale][key],
    }),
    [locale],
  );

  return (
    <LanguageContext.Provider value={value}>
      <ConfigProvider locale={antdLocaleByAppLocale[locale]}>
        {children}
      </ConfigProvider>
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context)
    throw new Error("useLanguage must be used within LanguageProvider.");
  return context;
}
