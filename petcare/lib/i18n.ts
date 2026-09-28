"use client";
import { useEffect, useSyncExternalStore } from "react";
import { translate, translateError } from "./translations.mjs";
export type Language = "ko" | "en" | "zh";
let current: Language = "en";
let initialized = false;
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export function t(text: string) {
  return translate(text, current);
}
export function errorText(text: string) {
  return translateError(text, current);
}
export function getLocale() {
  return { ko: "ko-KR", en: "en-US", zh: "zh-CN" }[current];
}
export function setLanguage(value: Language) {
  if (!["ko", "en", "zh"].includes(value)) return;
  current = value;
  initialized = true;
  try {
    localStorage.setItem("pawday-language", value);
  } catch {}
  document.documentElement.lang = getLocale();
  document.title = t("포데이 · 함께하는 건강한 하루");
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute("content", t("반려동물의 일상과 건강을 함께 기록하세요."));
  if ("caches" in window)
    void caches
      .open("pawday-preferences")
      .then((cache) => cache.put("/__language", new Response(getLocale())))
      .catch(() => {});
  window.dispatchEvent(new Event("pawday-language-changed"));
  listeners.forEach((fn) => fn());
}
export function useLanguage() {
  const language = useSyncExternalStore(
    subscribe,
    () => current,
    () => "en" as Language,
  );
  useEffect(() => {
    if (!initialized) setLanguage("en");
  }, []);
  return [language, setLanguage] as const;
}
export function useLanguageReady() {
  return useSyncExternalStore(
    subscribe,
    () => initialized,
    () => false,
  );
}
export function dayLabels() {
  return {
    ko: ["일", "월", "화", "수", "목", "금", "토"],
    en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    zh: ["日", "一", "二", "三", "四", "五", "六"],
  }[current];
}
export function useLocalizedValidation() {
  useEffect(() => {
    const invalid = (event: Event) => {
      const input = event.target as HTMLInputElement;
      if (!input.setCustomValidity) return;
      input.setCustomValidity("");
      const v = input.validity;
      if (!v.valid)
        input.setCustomValidity(
          t(
            v.valueMissing
              ? "필수 항목을 입력하거나 선택하세요."
              : v.rangeOverflow ||
                  v.rangeUnderflow ||
                  v.stepMismatch ||
                  v.badInput
                ? "허용된 범위의 숫자를 입력하세요."
                : "입력 형식을 확인하세요.",
          ),
        );
    };
    const clear = (event: Event) =>
      (event.target as HTMLInputElement).setCustomValidity?.("");
    const clearAll = () =>
      document
        .querySelectorAll<HTMLInputElement>("input,select,textarea")
        .forEach((input) => input.setCustomValidity(""));
    document.addEventListener("invalid", invalid, true);
    document.addEventListener("input", clear, true);
    document.addEventListener("change", clear, true);
    window.addEventListener("pawday-language-changed", clearAll);
    return () => {
      document.removeEventListener("invalid", invalid, true);
      document.removeEventListener("input", clear, true);
      document.removeEventListener("change", clear, true);
      window.removeEventListener("pawday-language-changed", clearAll);
    };
  }, []);
}
