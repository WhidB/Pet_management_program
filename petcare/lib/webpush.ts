// Payload-free Web Push: the service worker fetches private content with its own session.
// VAPID RFC 8292; no pet/document content is sent to third-party push endpoints.
import { config, AppError } from "./server";
const encoder = new TextEncoder();
export const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
export function unb64(value: string) {
  return Uint8Array.from(
    atob(value.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0),
  );
}
export function validEndpoint(endpoint: string) {
  try {
    const u = new URL(endpoint);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.port &&
      (u.hostname === "fcm.googleapis.com" ||
        u.hostname === "updates.push.services.mozilla.com" ||
        u.hostname.endsWith(".push.services.mozilla.com") ||
        u.hostname === "web.push.apple.com" ||
        u.hostname.endsWith(".notify.windows.com"))
    );
  } catch {
    return false;
  }
}
export async function wake(endpoint: string) {
  if (!validEndpoint(endpoint))
    throw new AppError("지원하지 않는 푸시 서버입니다.");
  const cfg = config();
  if (!cfg.VAPID_PRIVATE_KEY || !cfg.VAPID_PUBLIC_KEY)
    throw new AppError("웹 푸시 키가 연결되지 않았습니다.", 503);
  const pub = unb64(cfg.VAPID_PUBLIC_KEY),
    key = await crypto.subtle.importKey(
      "jwk",
      {
        kty: "EC",
        crv: "P-256",
        x: b64url(pub.slice(1, 33)),
        y: b64url(pub.slice(33, 65)),
        d: cfg.VAPID_PRIVATE_KEY,
        ext: true,
      },
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"],
    );
  const header = b64url(
      encoder.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })),
    ),
    payload = b64url(
      encoder.encode(
        JSON.stringify({
          aud: new URL(endpoint).origin,
          exp: Math.floor(Date.now() / 1000) + 3600,
          sub: cfg.VAPID_SUBJECT || "mailto:admin@example.com",
        }),
      ),
    ),
    message = header + "." + payload;
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      encoder.encode(message),
    ),
  );
  return fetch(endpoint, {
    method: "POST",
    redirect: "error",
    headers: {
      Authorization: `vapid t=${message}.${b64url(signature)}, k=${cfg.VAPID_PUBLIC_KEY}`,
      TTL: "60",
      Urgency: "normal",
    },
    signal: AbortSignal.timeout(10000),
  });
}
