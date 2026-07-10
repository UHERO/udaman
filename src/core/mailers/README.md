# Mailers

Unified notification gateway for email, Slack, and SMS.

## Usage

```typescript
import { Mailer } from "@/core/mailers/mailer";

// Send with the default sender (udaman.bot@gmail.com)
await Mailer.email({
  to: "user@hawaii.edu",
  subject: "Upload Complete",
  html: "<h1>Done</h1>",
});

// Send with a named sender
await Mailer.email({
  sender: "uherosrv",
  to: "user@hawaii.edu",
  subject: "Report Ready",
  html: "<p>Your report is ready.</p>",
  attachments: [{ filename: "report.csv", content: csvBuffer }],
});

// Send a Slack message
await Mailer.slack({
  channel: "#udaman",
  text: "Upload complete!",
});

// Send an SMS
await Mailer.sms({
  to: "+18081234567",
  body: "Hello from UDAMAN",
});
```

All `Mailer` methods are fire-and-forget friendly. Use `.catch()` so notification failures never break business logic:

```typescript
Mailer.email({ to, subject, html }).catch((err) =>
  log.error(err, "Failed to send notification"),
);
```

## Env Vars

### Default sender

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=udaman.bot@gmail.com
SMTP_PASS=<app-password>
MAIL_FROM=udaman.bot@gmail.com
```

Or use Gmail OAuth2 (takes precedence over basic auth if set):

```
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REFRESH_TOKEN=...
```

### Named senders

Add a sender by setting prefixed env vars. The prefix is `SMTP_<SENDER>_*` where `<SENDER>` is the uppercased sender key.

Example for sender key `"uherosrv"`:

```
SMTP_UHEROSRV_HOST=smtp.hawaii.edu
SMTP_UHEROSRV_PORT=587
SMTP_UHEROSRV_USER=uherosrv@hawaii.edu
SMTP_UHEROSRV_PASS=<password>
SMTP_UHEROSRV_FROM=uherosrv@hawaii.edu
SMTP_UHEROSRV_SECURE=true
```

Named senders can also use OAuth2 via `GMAIL_<SENDER>_*` vars.

### Slack

```
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...     # for incoming webhook signature verification
```

### SMS (Twilio)

```
TWILIO_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE=+18001234567
```

### Global flags

| Var                         | Effect                                                  |
| --------------------------- | ------------------------------------------------------- |
| `MAIL_DISABLED=1`           | All email sends become no-ops (logged only)             |
| `SLACK_DISABLED=1`          | All Slack sends become no-ops (logged only)             |
| `SMS_DISABLED=1`            | All SMS sends become no-ops (logged only)               |
| `NODE_ENV !== "production"` | All email recipients redirected to `DEV_MAIL_RECIPIENT` |

## Adding a new named sender

1. Choose a sender key (e.g. `"reports"`).
2. Set `SMTP_REPORTS_HOST`, `SMTP_REPORTS_PORT`, `SMTP_REPORTS_USER`, `SMTP_REPORTS_PASS`, `SMTP_REPORTS_FROM` in your env.
3. Use it: `Mailer.email({ sender: "reports", to, subject, html })`.

No code changes needed — the transport layer auto-discovers senders from env vars.

## Gmail OAuth2 setup

For senders using Gmail, OAuth2 is recommended over app passwords.

1. Create OAuth2 credentials in [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Enable the Gmail API for the project.
3. Run the refresh token helper script:
   ```bash
   GMAIL_CLIENT_ID=<id> GMAIL_CLIENT_SECRET=<secret> npx tsx scripts/gmail-oauth-token.ts
   ```
4. Follow the prompts to authorize and obtain a refresh token.
5. Set `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, and `GMAIL_REFRESH_TOKEN` in your env.

## `/udaman` Slash Command

A Slack slash command webhook at `/api/webhooks/slack` provides a 2-way integration.

**Setup in Slack App dashboard:**

1. Add OAuth scope `chat:write` under **Bot Token Scopes**
2. Install the app to the workspace
3. Copy the **Bot User OAuth Token** (`xoxb-...`) → `SLACK_BOT_TOKEN`
4. Invite the bot to `#udaman` channel (`/invite @YourBotName`)
5. Create slash command `/udaman` pointing to `https://udaman.uhero.hawaii.edu/api/webhooks/slack`
6. Copy **Signing Secret** from App Credentials → `SLACK_SIGNING_SECRET`

**Available commands:**

- `/udaman help` — List available notification channels

## Architecture

```
Mailer.email()          ← public API (src/core/mailers/mailer.ts)
  └── sendMail()        ← transport layer (src/core/mailers/transport.ts)
       └── nodemailer   ← SMTP / OAuth2 transporter per sender

Mailer.slack()          ← public API (src/core/mailers/mailer.ts)
  └── sendSlackMessage()← Slack layer (src/core/mailers/slack.ts)
       └── fetch        ← Slack chat.postMessage API

Mailer.sms()            ← public API (src/core/mailers/mailer.ts)
  └── sendSms()         ← SMS layer (src/core/mailers/sms.ts)
       └── fetch        ← Twilio REST API

/api/webhooks/slack     ← incoming Slack slash commands
  └── signature verify  ← HMAC-SHA256 via SLACK_SIGNING_SECRET
```

- `mailer.ts` — validates options, logs, delegates to transport/slack/sms
- `transport.ts` — multi-sender transporter cache, dev-safety redirect, MAIL_DISABLED
- `slack.ts` — Slack Bot Token posting, SLACK_DISABLED
- `sms.ts` — Twilio REST API, SMS_DISABLED
- `recipients.ts` — hardcoded recipient lists
- `dbedt-upload-mailer.ts` — DBEDT upload notification templates
