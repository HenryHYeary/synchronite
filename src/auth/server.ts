import http from "http";
import type { AddressInfo } from "net";

export function waitForOAuthRedirect(): {
  port: Promise<number>,
  code: Promise<string>,
} {
  let resolvePort!: (port: number) => void;
  let resolveCode!: (code: string) => void;
  let rejectCode!: (err: Error) => void;

  const portPromise = new Promise<number>((res) => { resolvePort: res; });
  const codePromise = new Promise<string>((res, rej) => { resolveCode: res; rejectCode: rej; });
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "", "http://127.0.0.1");
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(
      error
      ? "<h1>Authorization failed.</h1><p>You can close this tab.</p>"
      : "<h1>Success!</h1><p>You can close this tab and return to the terminal.</p>"
    );

    server.close();
    if (error) rejectCode(new Error(`OAuth error: ${error}`));
    else if (code) resolveCode(code);
    else rejectCode(new Error("No code or error returned in OAuth redirect."));
  });

  server.listen(0, "127.0.0.1", () => {
    resolvePort((server.address() as AddressInfo).port);
  });

  return { port: portPromise, code: codePromise };
}