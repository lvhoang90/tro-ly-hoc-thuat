// Đóng gói máy chủ (server/ + thư viện) thành một tệp server-dist/ để chạy trên hosting dùng chung mà không cần cài lại thư viện.
import { build } from "esbuild";

await build({
  entryPoints: { index: "server/index.ts", import: "server/cli-import.ts" },
  outdir: "server-dist", entryNames: "[name]", outExtension: { ".js": ".mjs" },
  bundle: true, platform: "node", format: "esm", target: "node22", sourcemap: false, legalComments: "none",
  banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
  logLevel: "info",
});
