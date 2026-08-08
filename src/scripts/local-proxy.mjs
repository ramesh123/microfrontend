/**
 * Local reverse proxy for MFA static serve:
 *   /api/v2 → DataFusion test API
 *   /api    → DataFusion demo API (override with API_TARGET)
 *   /*      → container static host (default :3010)
 *
 * Workflow remote stays on :3001 (Module Federation).
 */
import http from "node:http";
import https from "node:https";
import { URL } from "node:url";

const LISTEN_PORT = Number(process.env.PROXY_PORT || 3000);
const CONTAINER_TARGET = process.env.CONTAINER_TARGET || "http://127.0.0.1:3010";
// Match the team's nginx MFA backend (100.48.89.114 is currently unreachable;
// 165.101.248.88 is the working alternate from the same nginx config).
const API_TARGET = process.env.API_TARGET || "https://165.101.248.88";
const API_V2_TARGET =
  process.env.API_V2_TARGET || "https://test.datafusion.algofusiontech.com";
const API_HOST_HEADER = process.env.API_HOST_HEADER || "45.195.90.205";

const REQ_DROP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "content-length",
  "host",
  "accept-encoding",
]);

function pickTarget(urlPath) {
  if (urlPath.startsWith("/api/v2")) return API_V2_TARGET;
  if (urlPath.startsWith("/api")) return API_TARGET;
  return CONTAINER_TARGET;
}

function rewriteSetCookie(values) {
  const list = Array.isArray(values) ? values : [values];
  return list.map((cookie) =>
    String(cookie)
      // localhost is http — drop Secure so the browser will store the session cookie
      .replace(/;\s*Secure/gi, "")
      // drop Domain so cookie is host-only for localhost
      .replace(/;\s*Domain=[^;]*/gi, "")
      // SameSite=None requires Secure; relax for local http
      .replace(/;\s*SameSite=None/gi, "; SameSite=Lax"),
  );
}

function proxyRequest(clientReq, clientRes) {
  const reqUrl = clientReq.url || "/";
  const targetBase = pickTarget(reqUrl);
  const targetUrl = new URL(reqUrl, targetBase);
  const isHttps = targetUrl.protocol === "https:";
  const lib = isHttps ? https : http;
  const isApi = reqUrl.startsWith("/api");

  const headers = {};
  for (const [key, value] of Object.entries(clientReq.headers)) {
    if (value == null) continue;
    if (REQ_DROP.has(key.toLowerCase())) continue;
    headers[key] = value;
  }
  headers.host = API_HOST_HEADER && isApi ? API_HOST_HEADER : targetUrl.host;

  const upstreamReq = lib.request(
    {
      protocol: targetUrl.protocol,
      hostname: targetUrl.hostname,
      port: targetUrl.port || (isHttps ? 443 : 80),
      path: targetUrl.pathname + targetUrl.search,
      method: clientReq.method,
      headers,
      rejectUnauthorized: false,
    },
    (upstreamRes) => {
      const resHeaders = {};
      for (const [key, value] of Object.entries(upstreamRes.headers)) {
        if (value == null) continue;
        const lower = key.toLowerCase();
        if (lower === "transfer-encoding" || lower === "connection" || lower === "keep-alive") {
          continue;
        }
        if (lower === "set-cookie") {
          resHeaders["set-cookie"] = rewriteSetCookie(value);
          continue;
        }
        resHeaders[key] = value;
      }

      try {
        clientRes.writeHead(upstreamRes.statusCode || 502, resHeaders);
      } catch (err) {
        console.error("[proxy] writeHead failed:", err.message);
        clientRes.destroy();
        return;
      }
      upstreamRes.pipe(clientRes);
    },
  );

  upstreamReq.on("error", (err) => {
    console.error(`[proxy] ${clientReq.method} ${reqUrl} → ${targetBase}:`, err.message);
    if (!clientRes.headersSent) {
      clientRes.writeHead(502, { "Content-Type": "application/json" });
      clientRes.end(JSON.stringify({ status: false, msg: `Bad Gateway: ${err.message}` }));
    } else {
      clientRes.end();
    }
  });

  clientReq.on("aborted", () => upstreamReq.destroy());
  clientReq.on("error", () => upstreamReq.destroy());
  clientReq.pipe(upstreamReq);
}

process.on("uncaughtException", (err) => {
  console.error("[proxy] uncaughtException:", err);
});
process.on("unhandledRejection", (err) => {
  console.error("[proxy] unhandledRejection:", err);
});

const server = http.createServer(proxyRequest);
server.requestTimeout = 0;
server.headersTimeout = 0;
server.keepAliveTimeout = 65_000;

server.on("error", (err) => {
  console.error("[proxy] server error:", err);
  process.exit(1);
});

server.listen(LISTEN_PORT, "0.0.0.0", () => {
  console.log(`[proxy] listening on http://localhost:${LISTEN_PORT}`);
  console.log(`[proxy] /          → ${CONTAINER_TARGET}`);
  console.log(`[proxy] /api       → ${API_TARGET}${API_HOST_HEADER ? ` (Host: ${API_HOST_HEADER})` : ""}`);
  console.log(`[proxy] /api/v2    → ${API_V2_TARGET}`);
});
