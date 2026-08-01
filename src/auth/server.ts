import http from "http";

export const CALLBACK_PORT = 53682;

export function waitForCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "", `http://localhost:${CALLBACK_PORT}`);
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(
        error
        ? "<h1>Authorization failed.</h1><p>You can close this tab.</p>"
        : "<h1>Success!</h1><p>You can close this tab and return to the terminal.</p>"
      );

      server.close();

      if (error) reject(new Error(`Dropbox denied authorization: ${error}`));
      else if (code) resolve(code);
      else reject(new Error("No code returned from Dropbox."));
    });

    server.listen(CALLBACK_PORT);
  });
}