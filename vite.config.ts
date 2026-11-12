import { createHash } from "node:crypto";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

// Dev-only stand-in for /api/save-application. Set MANAGE_LOCAL_FILE to a copy of
// applications.json. GitHub is never contacted; the handler still runs.
function localManageApi(): Plugin {
  const file = process.env.MANAGE_LOCAL_FILE;
  const logFile = process.env.MANAGE_REQUEST_LOG;
  return {
    name: "local-manage-api",
    apply: "serve",
    configureServer(server) {
      if (!file) return;
      let sha = createHash("sha1").update(readFileSync(file)).digest("hex");
      let failFirst = process.env.MANAGE_FAIL_FIRST === "1";
      server.middlewares.use("/api/save-application", (req, res, next) => {
        if (req.method === "GET") {
          res.statusCode = 405;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: "method_not_allowed" }));
          return;
        }
        if (req.method !== "POST") {
          next();
          return;
        }
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => {
          chunks.push(Buffer.from(chunk));
        });
        req.on("end", () => {
          void (async () => {
            const rawBody = Buffer.concat(chunks).toString("utf8");
            if (logFile) appendFileSync(logFile, `${rawBody}\n`);
            if (failFirst) {
              failFirst = false;
              res.statusCode = 503;
              res.setHeader("content-type", "application/json");
              res.end(JSON.stringify({ error: "not_configured", message: "GITHUB_TOKEN is not set on the server." }));
              return;
            }
            process.env.GITHUB_TOKEN ||= "local-test-token";
            process.env.GITHUB_REPO ||= "local/job-status-board";
            process.env.GITHUB_BRANCH ||= "main";
            const original = globalThis.fetch;
            globalThis.fetch = async (input, init) => {
              const url = String(input instanceof Request ? input.url : input);
              if (!url.startsWith("https://api.github.com/")) return original(input, init);
              const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
              if (method === "GET") {
                const text = readFileSync(file, "utf8");
                sha = createHash("sha1").update(text).digest("hex");
                const wrapped = Buffer.from(text, "utf8").toString("base64").replace(/.{60}/g, "$&\n");
                return new Response(JSON.stringify({ sha, content: wrapped, encoding: "base64" }), {
                  status: 200,
                  headers: { "content-type": "application/json" },
                });
              }
              const bodyText = typeof init?.body === "string" ? init.body : "";
              const payload = JSON.parse(bodyText) as { content?: string; sha?: string };
              if (payload.sha !== sha) return new Response(JSON.stringify({ message: "sha mismatch" }), { status: 409 });
              const text = Buffer.from(payload.content ?? "", "base64").toString("utf8");
              writeFileSync(file, text);
              sha = createHash("sha1").update(text).digest("hex");
              return new Response(JSON.stringify({ commit: { sha } }), {
                status: 200,
                headers: { "content-type": "application/json" },
              });
            };
            try {
              const loaded = (await server.ssrLoadModule(resolve("api/save-application.ts"))) as {
                default: { fetch: (request: Request) => Promise<Response> };
              };
              const request = new Request("http://127.0.0.1/api/save-application", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: rawBody,
              });
              const response = await loaded.default.fetch(request);
              res.statusCode = response.status;
              res.setHeader("content-type", "application/json");
              res.end(Buffer.from(await response.arrayBuffer()));
            } catch (error) {
              res.statusCode = 500;
              res.setHeader("content-type", "application/json");
              res.end(JSON.stringify({ error: "local", message: error instanceof Error ? error.message : "Local save failed." }));
            } finally {
              globalThis.fetch = original;
            }
          })();
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), localManageApi()],
  server: {
    host: "0.0.0.0",
    port: 4327,
    strictPort: true,
  },
  preview: {
    host: "0.0.0.0",
    port: 4327,
    strictPort: true,
  },
});
