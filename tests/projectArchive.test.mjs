import test from "node:test";
import assert from "node:assert/strict";

import { createProjectArchive } from "../src/lib/projectArchive.js";

function readStoredEntries(archive) {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  const decoder = new TextDecoder();
  const files = {};
  let offset = 0;

  while (view.getUint32(offset, true) === 0x04034b50) {
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const size = view.getUint32(offset + 18, true);
    const nameStart = offset + 30;
    const contentStart = nameStart + nameLength + extraLength;
    const name = decoder.decode(archive.subarray(nameStart, nameStart + nameLength));
    files[name] = decoder.decode(archive.subarray(contentStart, contentStart + size));
    offset = contentStart + size;
  }

  return { files, view, endOffset: offset };
}

test("creates a ZIP archive containing all project files and nested paths", () => {
  const archive = createProjectArchive({
    "index.html": "<h1>Hello</h1>",
    "src/App.js": "export default function App() {}",
    "public/manifest.webmanifest": '{"name":"Hello"}',
  });
  const { files, view, endOffset } = readStoredEntries(archive);

  assert.deepEqual(files, {
    "index.html": "<h1>Hello</h1>",
    "src/App.js": "export default function App() {}",
    "public/manifest.webmanifest": '{"name":"Hello"}',
  });
  assert.equal(view.getUint32(endOffset, true), 0x02014b50);
  assert.equal(view.getUint32(archive.length - 22, true), 0x06054b50);
  assert.equal(view.getUint16(archive.length - 14, true), 3);
});

test("rejects unsafe project paths and invalid project data", () => {
  assert.throws(() => createProjectArchive({ "../outside.txt": "no" }), /invalid file path/);
  assert.throws(() => createProjectArchive({ "src\\App.js": "no" }), /invalid file path/);
  assert.throws(() => createProjectArchive({}), /valid set of files/);
});
