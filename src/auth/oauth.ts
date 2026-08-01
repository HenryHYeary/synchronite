import { generateCodeChallenge, generateCodeVerififer } from "./pkce.js";
import { CALLBACK_PORT } from "./server.js";

const APP_KEY = "";
const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}/callback`;

interface TokenResponse {
  access_token: string,
  refresh_token: string,
  expires_in: number,
}

function buildAuthorizeUrl(codeChallenge: string): string {
  const params = new URLSearchParams({
    clientId: APP_KEY,
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

const verifier = generateCodeVerififer();
const challenge = generateCodeChallenge(verifier);

const authUrl = buildAuthorizeUrl(challenge);