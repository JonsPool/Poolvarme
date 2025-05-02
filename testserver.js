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
    [1746136800000, 8.85, false],
    [1746140400000, 7.228, false],
    [1746144000000, 6.209, false],
    [1746147600000, 6.194, false],
    [1746151200000, 6.631, false],
    [1746154800000, 7.722, false],
    [1746158400000, 8.797, false],
    [1746162000000, 7.878, false],
    [1746165600000, 5.802, false],
    [1746169200000, 1.018, false],
    [1746172800000, 0.085, false],
    [1746176400000, -0.001, false],
    [1746180000000, -0.08, true],
    [1746183600000, -0.3, true],
    [1746187200000, -0.4, true],
    [1746190800000, -0.008, true],
    [1746194400000, 0.03, false],
    [1746198000000, 7.032, false],
    [1746201600000, 10.295, false],
    [1746205200000, 12.335, false],
    [1746208800000, 14.837, false],
    [1746212400000, 12.338, false],
    [1746216000000, 10.894, false],
    [1746219600000, 9.872, false],
  ],
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
      for (const row of data.t) {
        if (row[0] === upd.ts) {
          row[2] = upd.on;
          break;
        }
      }
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ message: "received" }));
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
