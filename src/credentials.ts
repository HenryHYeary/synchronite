import { z } from "zod";
import fs from "fs";
import { APP_PATHS } from "./paths.js";

export const CredentialsSchema = z.object({
  accessToken: z.string(),
});

export type Credentials = z.infer<typeof CredentialsSchema>;

export function loadCredentials(filePath = APP_PATHS.credentials): Credentials {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const result = CredentialsSchema.safeParse(raw);

  if (!result.success) {
    throw new Error("Error parsing credentials.", { cause: z.treeifyError(result.error) });
  }

  return result.data;
}