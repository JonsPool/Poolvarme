/*
This server simulates the behavior of the script endpoints on the Shelly - useful for
developing and testing endpoint.html. The HTML is automatically reloaded on change.

Start with 'npm run dev'.
*/

import { readFile, watch } from "fs/promises";
import http from "http";

const hostname = "127.0.0.1";
const port = 3000;
const htmlPath = "./src/endpoint.html";

const data = {
  nextUpdate: 1742047420995,
  switchID: 0,
  times: {
    1741917600000: 10.383,
    1741950000000: 10.412,
    1741953600000: 10.418,
    1741989600000: 10.517,
    1741921200000: 10.53,
    1741946400000: 10.568,
    1741914000000: 10.59,
    1741910400000: 10.6,
    1741957200000: 10.737,
    1741906800000: 10.909,
    1741993200000: null,
    1741924800000: null,
    1741960800000: null,
  },
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

// Watch for changes to endpoint.html
watch(htmlPath, async eventType => {
  if (eventType === "change") {
    await loadEndpointHTML();
  }
});

const server = http.createServer((req, res) => {
  if (req.method === "GET") {
    if (req.url === "/spotelly") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html");
      res.end(endpointHTML);
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
