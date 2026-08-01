import { z } from "zod";
import fs from "fs";
import { APP_PATHS } from "../paths.js";

const credentialsSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.number(),
});

export type Credentials = z.infer<typeof credentialsSchema>;

export function saveCredentials(tokens: {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}): void {
  const credentials: Credentials = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  };

  fs.writeFileSync(APP_PATHS.credentials, JSON.stringify(credentials, null, 2));
}

export function loadCredentials(): Credentials | null {
  if (!fs.existsSync(APP_PATHS.credentials)) return null;

  const raw = JSON.parse(fs.readFileSync(APP_PATHS.credentials, "utf-8"));
  const result = credentialsSchema.safeParse(raw);

  if (!result.success) {
    throw new Error("Invalid credentials file", { cause: result.error });
  }

  return result.data;
}