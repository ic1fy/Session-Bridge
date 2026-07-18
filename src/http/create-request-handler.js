import { ServiceError } from "../errors/service-error.js";
import { parseSessionJson } from "../session/parse-session-json.js";

const BODY_LIMIT = 32 * 1024;
const SECURITY_HEADERS = {
  "content-security-policy":
    "default-src 'self'; connect-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "cache-control": "no-store",
};

function sendJson(response, status, payload) {
  response.writeHead(status, {
    ...SECURITY_HEADERS,
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

async function readBody(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > BODY_LIMIT) {
      throw new ServiceError(
        "INPUT_TOO_LARGE",
        "请求超过 32 KiB 限制。",
        413,
      );
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function readJsonBody(request) {
  const text = await readBody(request);
  try {
    return JSON.parse(text);
  } catch {
    throw new ServiceError("INVALID_JSON", "请求内容不是有效的 JSON。");
  }
}

export function createRequestHandler({
  edgeManager,
  requestToken,
  indexHtml,
  assets,
}) {
  return async (request, response) => {
    const localPort = request.socket.localPort;
    const expectedHost = `127.0.0.1:${localPort}`;
    const expectedOrigin = `http://${expectedHost}`;

    try {
      if (request.headers.host !== expectedHost) {
        throw new ServiceError("FORBIDDEN", "请求来源不受信任。", 403);
      }

      if (request.method === "GET" && request.url === "/") {
        response.writeHead(200, {
          ...SECURITY_HEADERS,
          "content-type": "text/html; charset=utf-8",
        });
        response.end(indexHtml.replace("__REQUEST_TOKEN__", requestToken));
        return;
      }

      if (request.method === "GET" && assets.has(request.url)) {
        const asset = assets.get(request.url);
        response.writeHead(200, {
          ...SECURITY_HEADERS,
          "content-type": asset.type,
        });
        response.end(asset.body);
        return;
      }

      if (request.method === "POST" && request.url === "/api/open-edge") {
        if (
          request.headers.origin !== expectedOrigin ||
          request.headers["x-local-request-token"] !== requestToken
        ) {
          throw new ServiceError("FORBIDDEN", "请求来源不受信任。", 403);
        }
        if (!request.headers["content-type"]?.startsWith("application/json")) {
          throw new ServiceError(
            "INVALID_CONTENT_TYPE",
            "请求必须使用 application/json。",
            415,
          );
        }

        const payload = await readJsonBody(request);
        const { sessionToken } = parseSessionJson(payload?.sessionJson);
        await edgeManager.openSession(sessionToken);
        sendJson(response, 200, { ok: true });
        return;
      }

      sendJson(response, 404, { ok: false, error: "页面不存在。" });
    } catch (error) {
      const safe =
        error instanceof ServiceError
          ? error
          : new ServiceError("INTERNAL_ERROR", "本地服务处理失败。", 500);
      sendJson(response, safe.statusCode, {
        ok: false,
        code: safe.code,
        error: safe.safeMessage,
      });
    }
  };
}
