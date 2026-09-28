"use client";
import { useCallback, useEffect, useState } from "react";
import { PawPrint } from "lucide-react";
import PetApp from "./pet-app";
import LanguageSelect from "./language-select";
import { t, useLanguage, useLanguageReady } from "../lib/i18n";

let startup: Promise<void> | undefined;
function startDemo() {
  if (!startup)
    startup = (async () => {
      const response = await fetch("/api/demo", {
        method: "POST",
        signal: AbortSignal.timeout(15000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: document.documentElement.lang.slice(0, 2),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      if (!response.ok) throw Error("Demo initialization failed");
      // Confirm the local database is ready before rendering the app.
      const check = await fetch("/api/data", { cache: "no-store", signal: AbortSignal.timeout(15000) });
      if (!check.ok) throw Error("Demo session unavailable");
    })().catch((error) => {
      startup = undefined;
      throw error;
    });
  return startup;
}

export default function DemoStart() {
  useLanguage();
  const languageReady = useLanguageReady();
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const begin = useCallback(async () => {
    setFailed(false);
    try {
      await startDemo();
      setReady(true);
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => {
    if (languageReady) void begin();
  }, [languageReady, begin]);
  if (ready) return <PetApp />;
  return (
    <div className="loading" role={failed ? "alert" : "status"}>
      <PawPrint size={36} />
      <h1>{t("내 컴퓨터의 포데이")}</h1>
      <p>
        {failed
          ? t(
              "앱을 열지 못했습니다. Pawday.cmd를 다시 실행한 뒤 재시도하세요.",
            )
          : t("저장된 반려동물 정보를 불러오고 있어요…")}
      </p>
      {failed && (
        <>
          <LanguageSelect />
          <button className="primary" onClick={begin}>
            {t("다시 시도")}
          </button>
        </>
      )}
    </div>
  );
}
