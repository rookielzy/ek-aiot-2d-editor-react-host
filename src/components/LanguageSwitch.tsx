import { GlobalOutlined } from "@ant-design/icons";
import { Segmented, Tooltip } from "antd";

import { type AppLocale, useLanguage } from "@/i18n/language";

import "./language-switch.css";

export interface LanguageSwitchProps {
  className?: string;
}

export function LanguageSwitch({ className }: LanguageSwitchProps) {
  const { locale, setLocale, t } = useLanguage();
  const classes = ["language-switch", className].filter(Boolean).join(" ");

  return (
    <Tooltip title={t("language.switch")}>
      <div className={classes}>
        <GlobalOutlined aria-hidden />
        <Segmented
          aria-label={t("language.switch")}
          options={[
            { label: "中", value: "zh-CN", title: t("language.zhCN") },
            { label: "EN", value: "en-US", title: t("language.enUS") },
          ]}
          size="small"
          value={locale}
          onChange={(value) => setLocale(value as AppLocale)}
        />
      </div>
    </Tooltip>
  );
}
