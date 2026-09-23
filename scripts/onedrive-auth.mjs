// One-time helper to get ONEDRIVE_REFRESH_TOKEN for the club Microsoft account.
// Usage:
//   AZURE_CLIENT_ID=... AZURE_CLIENT_SECRET=... AZURE_TENANT_ID=common node scripts/onedrive-auth.mjs
// Add http://localhost:53682/callback as a "Web" redirect URI in the Azure app registration,
// open the printed URL, sign in AS THE CLUB ACCOUNT, and the refresh token is printed here.

import http from "node:http";

const clientId = process.env.AZURE_CLIENT_ID;
const clientSecret = process.env.AZURE_CLIENT_SECRET;
const tenant = process.env.AZURE_TENANT_ID || "common";
const port = 53682;
const redirectUri = `http://localhost:${port}/callback`;
const scope = "Files.ReadWrite offline_access";

if (!clientId || !clientSecret) {
  console.error("Missing AZURE_CLIENT_ID / AZURE_CLIENT_SECRET");
  process.exit(1);
}

const authUrl =
  `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?` +
  new URLSearchParams({ client_id: clientId, response_type: "code", redirect_uri: redirectUri, response_mode: "query", scope, prompt: "select_account" });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, redirectUri);
  if (url.pathname !== "/callback") {
    res.writeHead(404).end();
    return;
  }
  const code = url.searchParams.get("code");
  if (!code) {
    res.writeHead(400).end(`Sign-in failed: ${url.searchParams.get("error_description") ?? "no code"}`);
    return;
  }
  const tokenRes = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri, grant_type: "authorization_code", scope }),
  });
  const data = await tokenRes.json();
  if (!tokenRes.ok || !data.refresh_token) {
    res.writeHead(500).end("Token exchange failed — see terminal.");
    console.error(data);
    process.exit(1);
  }
  res.writeHead(200, { "Content-Type": "text/plain" }).end("Done. You can close this tab and return to the terminal.");
  console.log("\nAdd this to your env (.env.local and Vercel):\n");
  console.log(`ONEDRIVE_REFRESH_TOKEN=${data.refresh_token}\n`);
  server.close();
});

server.listen(port, () => {
  console.log("Open this URL and sign in as the club account:\n");
  console.log(authUrl + "\n");
});
