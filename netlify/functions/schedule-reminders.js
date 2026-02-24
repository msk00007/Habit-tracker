const ONE_SIGNAL_API_URL = "https://api.onesignal.com/notifications";
const MAX_REMINDERS_PER_REQUEST = 80;

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const parseBody = (raw) => {
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
};

const toUuid = (seed) => {
  const source = String(seed || "").trim();
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(source)
  ) {
    return source.toLowerCase();
  }

  let hash = 2166136261;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  const chunk = (value) => (value >>> 0).toString(16).padStart(8, "0");
  const h1 = chunk(hash);
  const h2 = chunk(hash ^ 0x9e3779b9);
  const h3 = chunk(hash ^ 0x85ebca6b);
  const h4 = chunk(hash ^ 0xc2b2ae35);
  const hex = `${h1}${h2}${h3}${h4}`.slice(0, 32);

  const timeLow = hex.slice(0, 8);
  const timeMid = hex.slice(8, 12);
  const timeHi = `4${hex.slice(13, 16)}`;
  const clockSeqRaw = parseInt(hex.slice(16, 20), 16);
  const clockSeq = ((clockSeqRaw & 0x3fff) | 0x8000).toString(16).padStart(4, "0");
  const node = hex.slice(20, 32);
  return `${timeLow}-${timeMid}-${timeHi}-${clockSeq}-${node}`;
};

const toAuthHeader = (rawKey) => {
  const key = String(rawKey || "").trim();
  if (!key) return "";
  if (key.startsWith("Key ") || key.startsWith("key ")) return `Key ${key.slice(4).trim()}`;
  if (key.startsWith("Basic ")) return key;
  return `Key ${key}`;
};

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const appId = process.env.VITE_ONESIGNAL_APP_ID || process.env.ONESIGNAL_APP_ID;
  const restApiKey = process.env.ONESIGNAL_REST_API_KEY;
  const authHeader = toAuthHeader(restApiKey);
  if (!appId || !restApiKey) {
    return json(500, {
      error: "Missing OneSignal server env vars",
      required: ["VITE_ONESIGNAL_APP_ID (or ONESIGNAL_APP_ID)", "ONESIGNAL_REST_API_KEY"],
    });
  }

  const payload = parseBody(event.body);
  const subscriptionId =
    typeof payload.subscriptionId === "string" ? payload.subscriptionId.trim() : "";
  const reminders = Array.isArray(payload.reminders) ? payload.reminders : [];

  if (!subscriptionId) {
    return json(400, { error: "subscriptionId is required" });
  }
  if (reminders.length === 0) {
    return json(200, { scheduled: 0, skipped: 0, failed: 0 });
  }

  const limitedReminders = reminders.slice(0, MAX_REMINDERS_PER_REQUEST);
  let scheduled = 0;
  let failed = 0;
  const failures = [];

  for (const reminder of limitedReminders) {
    const title = typeof reminder.title === "string" ? reminder.title.trim() : "Habit reminder";
    const message = typeof reminder.message === "string" ? reminder.message.trim() : "";
    const sendAfter = typeof reminder.sendAfter === "string" ? reminder.sendAfter : "";
    const idempotencyKey =
      typeof reminder.idempotencyKey === "string" ? reminder.idempotencyKey.trim() : "";
    const uuidIdempotencyKey = toUuid(idempotencyKey);
    const sendAfterDate = new Date(sendAfter);

    if (!message || !sendAfter || !idempotencyKey || Number.isNaN(sendAfterDate.getTime())) {
      failed += 1;
      failures.push({ idempotencyKey, reason: "Invalid reminder payload" });
      continue;
    }

    try {
      const response = await fetch(ONE_SIGNAL_API_URL, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          app_id: appId,
          target_channel: "push",
          include_subscription_ids: [subscriptionId],
          headings: { en: title },
          contents: { en: message },
          url: "/",
          send_after: sendAfterDate.toUTCString(),
          idempotency_key: uuidIdempotencyKey,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        failed += 1;
        failures.push({ idempotencyKey, reason: errorText || "OneSignal API error" });
        continue;
      }

      scheduled += 1;
    } catch (error) {
      failed += 1;
      failures.push({ idempotencyKey, reason: error?.message || "Network error" });
    }
  }

  return json(200, {
    scheduled,
    failed,
    skipped: reminders.length - limitedReminders.length,
    failures: failures.slice(0, 8),
  });
};
