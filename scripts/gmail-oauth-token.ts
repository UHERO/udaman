/**
 * Interactive helper to obtain a Gmail OAuth2 refresh token.
 *
 * Usage:
 *   GMAIL_CLIENT_ID=<id> GMAIL_CLIENT_SECRET=<secret> npx tsx scripts/gmail-oauth-token.ts
 *
 * The script will:
 *   1. Print a Google consent URL
 *   2. Wait for you to paste the authorization code
 *   3. Exchange it for tokens and print the refresh token
 */

import * as readline from "node:readline";

const REDIRECT_URI = "urn:ietf:wg:oauth:2.0:oob";
const SCOPES = ["https://mail.google.com/"];
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const clientId =
    process.env.GMAIL_CLIENT_ID || (await prompt("Enter GMAIL_CLIENT_ID: "));
  const clientSecret =
    process.env.GMAIL_CLIENT_SECRET ||
    (await prompt("Enter GMAIL_CLIENT_SECRET: "));

  if (!clientId || !clientSecret) {
    console.error(
      "Error: GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET are required.",
    );
    process.exit(1);
  }

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPES.join(" "));
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");

  console.log("\n1. Open this URL in your browser and authorize:\n");
  console.log(`   ${authUrl.toString()}\n`);

  const code = await prompt("2. Paste the authorization code here: ");

  if (!code) {
    console.error("Error: No authorization code provided.");
    process.exit(1);
  }

  console.log("\nExchanging code for tokens...\n");

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  const data = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    console.error("Token exchange failed:", JSON.stringify(data, null, 2));
    process.exit(1);
  }

  if (typeof data.refresh_token !== "string") {
    console.error(
      "No refresh_token in response. Make sure you used prompt=consent.",
    );
    console.error("Response:", JSON.stringify(data, null, 2));
    process.exit(1);
  }

  console.log("Success! Add this to your environment:\n");
  console.log(`  GMAIL_REFRESH_TOKEN=${data.refresh_token}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
