const encoder = new TextEncoder();
const UTF8_FLAG = 0x0800;
const ZIP_LOCAL_FILE_HEADER = 0x04034b50;
const ZIP_CENTRAL_DIRECTORY_HEADER = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY = 0x06054b50;

const crcTable = new Uint32Array(256);
for (let index = 0; index < crcTable.length; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  crcTable[index] = value >>> 0;
}

function calculateCrc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeHeader(size, values) {
  const bytes = new Uint8Array(size);
  const view = new DataView(bytes.buffer);
  for (const [offset, value] of values) {
    view.setUint32(offset, value, true);
  }
  return { bytes, view };
}

export function createProjectArchive(files) {
  if (
    !files ||
    typeof files !== "object" ||
    Array.isArray(files) ||
    Object.keys(files).length === 0 ||
    Object.keys(files).length > 100
  ) {
    throw new Error("The project does not contain a valid set of files.");
  }

  const localEntries = [];
  const centralEntries = [];
  let localOffset = 0;

  for (const [path, contents] of Object.entries(files)) {
    if (
      typeof contents !== "string" ||
      path.length === 0 ||
      path.length > 200 ||
      path.startsWith("/") ||
      path.includes("\\") ||
      path.includes("\0") ||
      path.split("/").some((segment) =>
        segment === "" || segment === "." || segment === ".."
      )
    ) {
      throw new Error("The project contains an invalid file path or content.");
    }

    const nameBytes = encoder.encode(path);
    const contentBytes = encoder.encode(contents);
    if (nameBytes.length > 0xffff || contentBytes.length > 0xffffffff) {
      throw new Error("A project file exceeds the ZIP format size limit.");
    }

    const checksum = calculateCrc32(contentBytes);
    const local = writeHeader(30, [[0, ZIP_LOCAL_FILE_HEADER]]);
    local.view.setUint16(4, 20, true);
    local.view.setUint16(6, UTF8_FLAG, true);
    local.view.setUint16(8, 0, true);
    local.view.setUint16(12, 0x21, true);
    local.view.setUint32(14, checksum, true);
    local.view.setUint32(18, contentBytes.length, true);
    local.view.setUint32(22, contentBytes.length, true);
    local.view.setUint16(26, nameBytes.length, true);
    localEntries.push(local.bytes, nameBytes, contentBytes);

    const central = writeHeader(46, [[0, ZIP_CENTRAL_DIRECTORY_HEADER]]);
    central.view.setUint16(4, 20, true);
    central.view.setUint16(6, 20, true);
    central.view.setUint16(8, UTF8_FLAG, true);
    central.view.setUint16(10, 0, true);
    central.view.setUint16(14, 0x21, true);
    central.view.setUint32(16, checksum, true);
    central.view.setUint32(20, contentBytes.length, true);
    central.view.setUint32(24, contentBytes.length, true);
    central.view.setUint16(28, nameBytes.length, true);
    central.view.setUint32(42, localOffset, true);
    centralEntries.push(central.bytes, nameBytes);

    localOffset += local.bytes.length + nameBytes.length + contentBytes.length;
  }

  const centralSize = centralEntries.reduce((size, entry) => size + entry.length, 0);
  if (localOffset + centralSize > 0xffffffff) {
    throw new Error("The project is too large to export as a ZIP file.");
  }

  const end = writeHeader(22, [[0, ZIP_END_OF_CENTRAL_DIRECTORY]]);
  end.view.setUint16(8, centralEntries.length / 2, true);
  end.view.setUint16(10, centralEntries.length / 2, true);
  end.view.setUint32(12, centralSize, true);
  end.view.setUint32(16, localOffset, true);

  const archive = new Uint8Array(localOffset + centralSize + end.bytes.length);
  let offset = 0;
  for (const entry of [...localEntries, ...centralEntries, end.bytes]) {
    archive.set(entry, offset);
    offset += entry.length;
  }
  return archive;
}
