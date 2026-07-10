import { createLogger } from "@/core/observability/logger";

const log = createLogger("mailer.sms");

export async function sendSms(opts: {
  to: string;
  body: string;
}): Promise<void> {
  const disabled =
    process.env.SMS_DISABLED === "1" || process.env.SMS_DISABLED === "true";
  if (disabled) {
    log.info(
      { to: opts.to, bodyLength: opts.body.length },
      "SMS_DISABLED — skipping send",
    );
    return;
  }

  const sid = process.env.TWILIO_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE;

  if (!sid || !token || !from) {
    throw new Error(
      "Twilio not configured: TWILIO_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE are required",
    );
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;

  const params = new URLSearchParams();
  params.append("To", opts.to);
  params.append("From", from);
  params.append("Body", opts.body);

  const res = await fetch(url, {
    method: "POST",
    body: params,
    headers: {
      Authorization:
        "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Twilio SMS failed (${res.status}): ${errorBody}`);
  }

  const data = await res.json();

  log.info({ to: opts.to, from, sid: data.sid }, "SMS sent");
}
