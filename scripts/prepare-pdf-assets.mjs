import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// These browser assets come from the same locked PDF.js package as lib/pdf.ts.
// Generate them locally so a clean clone does not depend on vendored binaries.
const source = new URL("../node_modules/pdfjs-dist/", import.meta.url);
const destination = new URL("../public/pdf/", import.meta.url);

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await cp(new URL("build/pdf.worker.min.mjs", source),
  new URL("pdf.worker.min.mjs", destination));
for (const directory of ["cmaps", "standard_fonts", "wasm"]) {
  await cp(fileURLToPath(new URL(directory, source)),
    fileURLToPath(new URL(directory, destination)), { recursive: true });
}
