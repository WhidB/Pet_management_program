"use client";
import { useState, type InputHTMLAttributes } from "react";
import { t } from "../lib/i18n";

// The native file-button caption follows the browser language, not app language.
export default function FileInput(
  props: InputHTMLAttributes<HTMLInputElement>,
) {
  const [name, setName] = useState("");
  return (
    <span className="file-picker">
      <span className="file-picker-button">{t("파일 선택")}</span>
      <input
        {...props}
        type="file"
        aria-label={t("파일 선택")}
        onChange={(event) => {
          setName(event.target.files?.[0]?.name || "");
          props.onChange?.(event);
        }}
      />
      <span>{name || t("선택한 파일 없음")}</span>
    </span>
  );
}
