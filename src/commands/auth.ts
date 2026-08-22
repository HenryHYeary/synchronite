import * as p from "@clack/prompts";
import { authenticate } from "../auth/oauth.js";

export async function runAuth(): Promise<void> {
  const spinner = p.spinner();
  spinner.start("Waiting for dropbox authorization in your browser...");
  
  try {
    await authenticate();
    spinner.stop("Dropbox connected.");
  } catch (error) {
    spinner.stop("Dropbox authentication failed.");
    console.error(error);
    process.exit(1);
  }
}