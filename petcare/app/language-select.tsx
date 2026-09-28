"use client";
import { t, useLanguage, type Language } from "../lib/i18n";
export default function LanguageSelect() {
  const [language, setLanguage] = useLanguage();
  return (
    <select
      aria-label={t("언어")}
      value={language}
      onChange={(e) => setLanguage(e.target.value as Language)}
    >
      <option value="ko">{t("한국어")}</option>
      <option value="en">{t("영어")}</option>
      <option value="zh">{t("중국어 (간체)")}</option>
    </select>
  );
}
