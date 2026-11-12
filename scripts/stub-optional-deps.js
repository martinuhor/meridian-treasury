#!/usr/bin/env node
/**
 * Creates lightweight stubs for optional peer deps pulled in by
 * @wagmi/connectors / Privy that are unused by Meridian (Base/EVM only).
 */
const fs = require("fs");
const path = require("path");

const stubSource = path.join(__dirname, "../src/lib/stubs/empty-module.js");
const root = path.join(__dirname, "../node_modules");

const packages = [
  {
    name: "@x402/evm",
    files: ["index.js", "upto/client/index.js", "exact/client/index.js"],
    exports: {
      ".": "./index.js",
      "./upto/client": "./upto/client/index.js",
      "./exact/client": "./exact/client/index.js",
    },
  },
  {
    name: "@x402/core",
    files: ["index.js", "client/index.js"],
    exports: { ".": "./index.js", "./client": "./client/index.js" },
  },
  {
    name: "@x402/svm",
    files: ["index.js", "exact/client/index.js"],
    exports: { ".": "./index.js", "./exact/client": "./exact/client/index.js" },
  },
];

for (const pkg of packages) {
  const dir = path.join(root, ...pkg.name.split("/"));
  for (const file of pkg.files) {
    const target = path.join(dir, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(stubSource, target);
  }
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify(
      {
        name: pkg.name,
        version: "0.0.0-meridian-stub",
        main: "index.js",
        exports: pkg.exports,
      },
      null,
      2,
    ),
  );
}

console.log("Optional dependency stubs ready.");
