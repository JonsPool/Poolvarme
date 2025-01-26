/*
This build script inserts a compressed version of endpoint.html into the spotelly.js source file
and writes the resulting code to the ./dist folder. This is done to reduce RAM consumption on
the Shelly.

Steps performed:
1. Minify and gzip-compress the contents of ./src/endpoint.html and encode the result in Base64
2. Replace the {{ html }} placeholder in ./src/spotelly.js with the encoded string
3. Write the modified source to ./dist/final.js

This script must be run after each modification of either spotelly.js or endpoint.html and can
be executed with 'npm run build'.
*/

import fs from "node:fs";
import { minify } from "html-minifier";
import zlib from "node:zlib";

const main = (htmlfile, sourceJS, targetJS) => {
  const html = fs.readFileSync(htmlfile, "utf8");
  console.log("HTML:", html.length, "bytes");

  const minified = minify(html, {
    collapseInlineTagWhitespace: true,
    collapseWhitespace: true,
    minifyJS: true,
    removeAttributeQuotes: true,
    removeComments: true,
    removeOptionalTags: true,
  });
  console.log("Minified:", minified.length, "bytes");

  const compressed = zlib.gzipSync(minified);
  console.log("Compressed:", compressed.length, "bytes");

  const encoded = compressed.toString("base64");
  console.log("Encoded:", encoded.length, "bytes");

  const source = fs.readFileSync(sourceJS, "utf8");
  fs.writeFileSync(targetJS, source.replace(/{{ html }}/, encoded));
  console.log("Modified JS has been written to", targetJS);
};

main("./src/endpoint.html", "./src/spotelly.js", "./dist/final.js");
