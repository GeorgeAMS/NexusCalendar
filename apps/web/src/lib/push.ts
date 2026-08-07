import { pushApi } from "./api/endpoints";

const SW_PATH = "/push-sw.js";

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export type EnablePushResult = "enabled" | "denied" | "no-vapid" | "unsupported";

/**
 * Registers the push service worker ONLY when the user opts in and the API
 * actually has a VAPID key. Nothing is registered at app boot.
 */
export async function enablePush(): Promise<EnablePushResult> {
  if (!pushSupported()) return "unsupported";

  const { publicKey } = await pushApi.publicKey();
  if (!publicKey) return "no-vapid";

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  const registration = await navigator.serviceWorker.register(SW_PATH);
  await navigator.serviceWorker.ready;

  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    }));

  const json = subscription.toJSON() as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return "denied";

  await pushApi.subscribe({
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  });
  return "enabled";
}

export async function disablePush(): Promise<void> {
  if (!pushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration(SW_PATH);
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    await pushApi.unsubscribe(subscription.endpoint).catch(() => undefined);
    await subscription.unsubscribe();
  }
  await registration?.unregister();
}
