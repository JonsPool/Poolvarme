/*
This server simulates the behavior of the script endpoints on the Shelly - useful for
developing and testing endpoint.html. The browser view is automatically refreshed when
endpoint.html is modified.

Start with 'npm run dev'.
*/

import { readFile, watch } from "fs/promises";
import { WebSocketServer } from "ws";
import http from "http";

const hostname = "127.0.0.1";
const port = 3000;
const wsPort = 3001;
const htmlPath = "./src/endpoint.html";

const data = {
  n: 1742047420995,
  s: 0,
  t: [
    [1745683200000, 7.963, true],
    [1745701200000, 7.405, true],
    [1745647200000, 6.909, true],
    [1745650800000, 3.445, true],
    [1745679600000, 3.099, true],
    [1745654400000, 0.255, true],
    [1745658000000, -0.001, true],
    [1745676000000, -0.001, true],
    [1745672400000, -0.208, true],
    [1745661600000, -0.473, true],
    [1745668800000, -1.05, true],
    [1745665200000, -1.251, true],
    [1745686800000, null, false],
    [1745704800000, null, false],
  ],
};

let endpointHTML = "";

const loadEndpointHTML = async () => {
  try {
    endpointHTML = await readFile(htmlPath, "utf8");
    console.log("Loaded endpoint.html content.");
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
