import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const assetsDir = path.resolve(process.cwd(), "dist/assets");
const JS_LIMITS = {
  totalGzip: 330 * 1024,
  largestGzip: 120 * 1024,
  entryGzip: 45 * 1024,
};

const files = readdirSync(assetsDir).filter((file) => file.endsWith(".js"));
const rows = files.map((file) => {
  const contents = readFileSync(path.join(assetsDir, file));
  return {
    file,
    raw: contents.length,
    gzip: gzipSync(contents).length,
  };
});

if (rows.length === 0) {
  console.error("No JavaScript assets found. Run the frontend build first.");
  process.exit(1);
}

const totalGzip = rows.reduce((sum, row) => sum + row.gzip, 0);
const largest = rows.reduce((max, row) => (row.gzip > max.gzip ? row : max));
const entry = rows.find(
  (row) => row.file.startsWith("index-") && row.file.endsWith(".js"),
);

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
for (const row of [...rows].sort((a, b) => b.gzip - a.gzip)) {
  console.log(
    `${row.file.padEnd(44)} ${kb(row.raw).padStart(9)} raw  ${kb(row.gzip).padStart(9)} gzip`,
  );
}
console.log(
  `\nTotal JS: ${kb(totalGzip)} gzip | largest: ${largest.file} ${kb(largest.gzip)} gzip`,
);

let failed = false;
if (totalGzip > JS_LIMITS.totalGzip) {
  console.error(
    `Total JS gzip ${kb(totalGzip)} exceeds ${kb(JS_LIMITS.totalGzip)}.`,
  );
  failed = true;
}
if (largest.gzip > JS_LIMITS.largestGzip) {
  console.error(
    `Largest chunk ${largest.file} is ${kb(largest.gzip)} gzip (limit ${kb(JS_LIMITS.largestGzip)}).`,
  );
  failed = true;
}
if (!entry) {
  console.error("Entry chunk index-*.js not found.");
  failed = true;
} else if (entry.gzip > JS_LIMITS.entryGzip) {
  console.error(
    `Entry chunk is ${kb(entry.gzip)} gzip (limit ${kb(JS_LIMITS.entryGzip)}).`,
  );
  failed = true;
}

process.exit(failed ? 1 : 0);
