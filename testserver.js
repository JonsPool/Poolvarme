/*
This server simulates the behavior of the script endpoints on the Shelly - useful for
developing and testing endpoint.html. The browser view is automatically refreshed when
endpoint.html is modified.

Start with 'npm run dev'.
*/

import { readFile, watch } from "fs/promises";
import http from "http";
import { WebSocketServer } from "ws";

const hostname = "127.0.0.1";
const port = 3000;
const wsPort = 3001;
const htmlPath = "./src/endpoint.html";

const data = {
  a: 1753912800000,
  n: 0,
  s: 0,
  p: [
    8.818, 7.808, 7.772, 7.422, 7.806, 7.926, 9.525, 10.023, 9.383, 8.271, 7.25, 7.324, 6.34, 5.05,
    3.588, 5.831, 7.605, 8.979, 9.49, 11, 12.997, 12.051, 11.045, 10.195,
  ],
  o: [
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    true,
    true,
    true,
    true,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
  ],
  r: 22663,
};

let endpointHTML = "";

const loadEndpointHTML = async () => {
  try {
    endpointHTML = await readFile(htmlPath, "utf8");
  } catch (error) {
    console.error("Error reading endpoint.html:", error);
    endpointHTML = "<h1>Error loading content</h1>";
  }
};

await loadEndpointHTML();

const clients = new Set();

(async () => {
  const watcher = watch(htmlPath);
  for await (const event of watcher) {
    if (event.eventType === "change") {
      await loadEndpointHTML();
      for (const client of clients) {
        if (client.readyState === 1) {
          client.send("reload");
        }
      }
    }
  }
})();

const server = http.createServer((req, res) => {
  if (req.method === "GET") {
    if (req.url === "/spotelly") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html");
      const injectedHTML = endpointHTML.replace(
        "</body>",
        `<script>
          const ws = new WebSocket("ws://${hostname}:${wsPort}");
          ws.onmessage = (event) => {
            if (event.data === "reload") location.reload();
          };
        </script></body>`,
      );
      res.end(injectedHTML);
    } else if (req.url === "/data") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(data));
    } else {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain");
      res.end("404 Not Found\n");
    }
  } else if (req.method === "POST" && req.url === "/data") {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
    });
    req.on("end", () => {
      const upd = JSON.parse(body);
      const idx = (upd.h - data.a) / 3600000;
      data.o[idx] = upd.o;
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(data));
    });
  } else {
    res.statusCode = 405;
    res.setHeader("Content-Type", "text/plain");
    res.end("405 Method Not Allowed\n");
  }
});

server.listen(port, hostname, () => {
  console.log(`http://${hostname}:${port}/spotelly`);
});

const wss = new WebSocketServer({ port: wsPort });
wss.on("connection", ws => {
  clients.add(ws);
  ws.on("close", () => clients.delete(ws));
});
