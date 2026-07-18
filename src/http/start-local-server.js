import { once } from "node:events";
import http from "node:http";
import { createRequestHandler } from "./create-request-handler.js";

export async function startLocalServer(options) {
  const server = http.createServer(createRequestHandler(options));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}`;
  return {
    server,
    url,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
