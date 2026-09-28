"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { t, errorText } from "../lib/i18n";

function supported() {
  return "Notification" in window && "serviceWorker" in navigator;
}

async function registration() {
  await navigator.serviceWorker.register("/sw.js");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              Error(t("알림 연결 시간이 초과되었습니다. 다시 시도하세요.")),
            ),
          10000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export default function NotificationControls({
  compact = false,
  notificationTitle,
}: {
  compact?: boolean;
  notificationTitle?: string;
}) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const refresh = () =>
      setEnabled(
        supported() &&
          Notification.permission === "granted" &&
          localStorage.getItem("pawday-device") === "on",
      );
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("pawday-notifications-changed", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pawday-notifications-changed", refresh);
    };
  }, []);

  async function send(delay = 0) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (!supported())
        throw Error(
          t(
            "이 브라우저는 기기 알림을 지원하지 않습니다. 앱 내부 알림을 이용하세요.",
          ),
        );
      // Request permission directly from the user's click, before other async work.
      let permissionTimer: ReturnType<typeof setTimeout> | undefined;
      let permission: NotificationPermission;
      try {
        permission = await Promise.race([
          Notification.requestPermission(),
          new Promise<never>((_, reject) => {
            permissionTimer = setTimeout(
              () =>
                reject(
                  Error(
                    t(
                      "권한 요청에 응답이 없습니다. 이 주소를 Chrome 또는 Edge에서 열고 다시 시도하세요.",
                    ),
                  ),
                ),
              15000,
            );
          }),
        ]);
      } finally {
        clearTimeout(permissionTimer);
      }
      if (permission !== "granted")
        throw Error(
          t(
            "알림 권한이 허용되지 않았습니다. 기기/브라우저 설정에서 변경하세요.",
          ),
        );
      const reg = await registration();
      if (!reg.active)
        throw Error(t("알림 연결 시간이 초과되었습니다. 다시 시도하세요."));
      await new Promise<void>((resolve, reject) => {
        const channel = new MessageChannel();
        const timer = setTimeout(() => {
          channel.port1.close();
          reject(Error(t("알림 연결 시간이 초과되었습니다. 다시 시도하세요.")));
        }, 5000);
        channel.port1.onmessage = (event) => {
          clearTimeout(timer);
          channel.port1.close();
          if (event.data?.ok) resolve();
          else
            reject(
              Error(
                t("알림을 표시하지 못했습니다. 브라우저 권한을 확인하세요."),
              ),
            );
        };
        reg.active!.postMessage(
          {
            type: "DEMO_NOTIFICATION",
            delay,
            title: notificationTitle || t("포데이 · 알림 테스트"),
            body: t("데모 알림입니다. 반려동물의 돌봄 일정을 확인해주세요."),
          },
          [channel.port2],
        );
      });
      localStorage.setItem("pawday-device", "on");
      setEnabled(true);
      window.dispatchEvent(new Event("pawday-notifications-changed"));
      window.dispatchEvent(new Event("care-changed"));
      setMessage(
        delay
          ? t(
              "10초 뒤 데모 알림을 예약했습니다. 다른 화면으로 이동해 보세요. 브라우저는 실행해 두세요.",
            )
          : t("기기 알림 테스트를 보냈습니다."),
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      reg?.active?.postMessage({ type: "CANCEL_DEMO_NOTIFICATIONS" });
      const sub = await reg?.pushManager?.getSubscription();
      if (sub) {
        const response = await fetch("/api/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        if (!response.ok) throw Error(t("요청에 실패했습니다."));
        await sub.unsubscribe();
      }
      localStorage.removeItem("pawday-device");
      for (const notification of (await reg?.getNotifications()) || [])
        notification.close();
      setEnabled(false);
      window.dispatchEvent(new Event("pawday-notifications-changed"));
      setMessage(t("이 기기 알림 꺼짐"));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={"notification-controls" + (compact ? " compact" : "")}>
      <div className="connection">
        <Bell size={18} />
        <strong>
          {enabled ? t("이 기기 알림 권한 연결") : t("이 기기 알림 꺼짐")}
        </strong>
      </div>
      <p className="subtext">
        {t(
          "데모에서는 실제 기기 알림을 보낼 수 있어요. 처음에는 브라우저의 알림 권한을 허용해주세요.",
        )}
      </p>
      <div className="button-row">
        <button
          type="button"
          className="primary"
          disabled={busy}
          onClick={() => send()}
        >
          {busy
            ? t("처리 중…")
            : enabled
              ? t("지금 테스트 알림")
              : t("알림 허용 및 테스트")}
        </button>
        <button type="button" disabled={busy} onClick={() => send(10000)}>
          {t("10초 뒤 데모 알림")}
        </button>
        {enabled && (
          <button type="button" disabled={busy} onClick={disable}>
            {t("알림 끄기")}
          </button>
        )}
      </div>
      <p className="muted">
        {t(
          "10초 데모는 브라우저가 실행 중일 때만 동작합니다. 앱 종료 후 일정 자동 발송은 정기 발송 서비스 연결이 필요합니다.",
        )}
      </p>
      {message && (
        <p className="notification-feedback" role="status">
          {errorText(message)}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {errorText(error)}
        </p>
      )}
    </div>
  );
}
