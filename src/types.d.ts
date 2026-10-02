/// <reference types="vite/client" />
declare module "mammoth/mammoth.browser";
declare module "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url" { const url: string; export default url }
declare module "citeproc";
declare module "pdfjs-dist/legacy/build/pdf.mjs" { export * from "pdfjs-dist" }
