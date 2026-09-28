export const DEMO_COOKIE = "pawday_demo_session";

export function readDemoToken(cookieHeader = "") {
  const value = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(DEMO_COOKIE + "="))
    ?.slice(DEMO_COOKIE.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}

export function newDemoToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
}

export async function demoOwner(token) {
  if (!/^[a-f0-9]{64}$/.test(token || "")) throw Error("Invalid demo session");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return (
    "demo_" +
    Array.from(new Uint8Array(digest), (value) =>
      value.toString(16).padStart(2, "0"),
    ).join("")
  );
}

export function demoCookie(token, secure) {
  return `${DEMO_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure ? "; Secure" : ""}`;
}
