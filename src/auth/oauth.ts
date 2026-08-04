import { generateCodeChallenge, generateCodeVerififer } from "./pkce.js";
import { CALLBACK_PORT, waitForCode } from "./server.js";
import { loadCredentials, saveCredentials, updateAccessToken } from "./credentials.js";

const APP_KEY = "v4sl0nuhvrn55ux";
const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}/callback`;

interface TokenResponse {
  access_token: string,
  refresh_token: string,
  expires_in: number,
}

interface RefreshResponse {
  access_token: string,
  expires_in: number,
}

function buildAuthorizeUrl(codeChallenge: string): string {
  const params = new URLSearchParams({
    client_id: APP_KEY,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    token_access_type: "offline",
  });

  return `https://www.dropbox.com/oauth2/authorize?${params.toString()}`;
}

async function exchangeCodeForTokens(code: string, verifier: string): Promise<TokenResponse> {
  const response = await fetch("https://api.dropbox.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      client_id: APP_KEY,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
  }

  return response.json();
}


export async function authenticate(): Promise<void> {
  const verifier = generateCodeVerififer();
  const challenge = generateCodeChallenge(verifier);

  const authUrl = buildAuthorizeUrl(challenge);
  console.log(`Open this URL in your browser to authorize Synchronite:\n${authUrl}`);

  const codePromise = waitForCode();

  const code = await codePromise;
  const tokens = await exchangeCodeForTokens(code, verifier);
  saveCredentials(tokens);
}

export async function refreshAccessToken(refreshToken: string): Promise<RefreshResponse> {
  const response = await fetch("https://api.dropbox.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: APP_KEY,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
  }

  return response.json();
}

export async function getValidAccessToken(): Promise<string> {
  const credentials = loadCredentials();
  if (!credentials) {
    throw new Error("No credentials found, run `synchronite init` first.");
  }

  if (credentials.expiresAt > Date.now() + 60000) {
    return credentials.accessToken;
  }

  const refreshed = await refreshAccessToken(credentials.refreshToken);
  updateAccessToken(refreshed.access_token, refreshed.expires_in);
  return refreshed.access_token;
}