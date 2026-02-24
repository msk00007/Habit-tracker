const ONE_SIGNAL_API_URL = "https://onesignal.com/api/v1/notifications";
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

const toAuthHeader = (rawKey) => {
  const key = String(rawKey || "").trim();
  if (!key) return "";
  if (key.startsWith("Basic ") || key.startsWith("Key ")) return key;
  return `Basic ${key}`;
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
          idempotency_key: idempotencyKey,
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
