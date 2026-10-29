/**
 * 讀寫 .xlsx 的第一個工作表。
 * 儲存格可以是文字或數字。
 */
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let crc = n;
  for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  CRC_TABLE[n] = crc;
}

function crc32(bytes) {
  let crc = ~0;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return ~crc >>> 0;
}
function u16(value) {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}
function u32(value) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, true);
  return bytes;
}
function concat(parts) {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
function readU16(bytes, offset) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(offset, true);
}
function readU32(bytes, offset) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, true);
}
async function deflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
function xmlEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function colName(index) {
  let n = index + 1;
  let name = "";
  while (n > 0) {
    const mod = (n - 1) % 26;
    name = String.fromCharCode(65 + mod) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}
function colIndex(ref) {
  const letters = String(ref).match(/[A-Z]+/)?.[0] || "A";
  let n = 0;
  for (const char of letters) n = n * 26 + (char.charCodeAt(0) - 64);
  return n - 1;
}
function decodeXml(value) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** 寫出只有第一個工作表的 .xlsx。 */
export async function rowsToXlsx(rows) {
  const strings = [];
  const indexOf = new Map();
  const stringIndex = (value) => {
    const text = String(value);
    if (!indexOf.has(text)) {
      indexOf.set(text, strings.length);
      strings.push(text);
    }
    return indexOf.get(text);
  };
  const sheetRows = rows.map((row, rowIndex) => {
    const cells = row.map((value, column) => {
      const ref = `${colName(column)}${rowIndex + 1}`;
      if (typeof value === "number" && Number.isFinite(value))
        return `<c r="${ref}"><v>${value}</v></c>`;
      return `<c r="${ref}" t="s"><v>${stringIndex(value ?? "")}</v></c>`;
    });
    return `<row r="${rowIndex + 1}">${cells.join("")}</row>`;
  });
  const files = new Map([
    [
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>`,
    ],
    [
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ],
    [
      "xl/workbook.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="菜色" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ],
    [
      "xl/_rels/workbook.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`,
    ],
    [
      "xl/worksheets/sheet1.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows.join("")}</sheetData></worksheet>`,
    ],
    [
      "xl/sharedStrings.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">${strings.map((item) => `<si><t>${xmlEscape(item)}</t></si>`).join("")}</sst>`,
    ],
  ]);
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, xml] of files) {
    const nameBytes = textEncoder.encode(name);
    const data = textEncoder.encode(xml);
    const compressed = await deflateRaw(data);
    const crc = crc32(data);
    const local = concat([
      u32(0x04034b50),
      u16(20),
      u16(0x0800),
      u16(8),
      u16(0),
      u16(0),
      u32(crc),
      u32(compressed.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      nameBytes,
      compressed,
    ]);
    const central = concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0x0800),
      u16(8),
      u16(0),
      u16(0),
      u32(crc),
      u32(compressed.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBytes,
    ]);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }
  const centralDir = concat(centrals);
  const end = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.size),
    u16(files.size),
    u32(centralDir.length),
    u32(offset),
    u16(0),
  ]);
  return concat([...locals, centralDir, end]);
}

function unzip(bytes) {
  if (bytes.length < 22 || bytes[0] !== 0x50 || bytes[1] !== 0x4b)
    throw new Error("這個檔案不是 Excel");
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i -= 1) {
    if (readU32(bytes, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("這個檔案不是 Excel");
  const count = readU16(bytes, eocd + 10);
  let cursor = readU32(bytes, eocd + 16);
  const entries = [];
  for (let i = 0; i < count; i += 1) {
    if (readU32(bytes, cursor) !== 0x02014b50) throw new Error("這個檔案不是 Excel");
    const method = readU16(bytes, cursor + 10);
    const compressedSize = readU32(bytes, cursor + 20);
    const nameLength = readU16(bytes, cursor + 28);
    const extraLength = readU16(bytes, cursor + 30);
    const commentLength = readU16(bytes, cursor + 32);
    const localOffset = readU32(bytes, cursor + 42);
    const name = textDecoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    entries.push({ name, method, compressedSize, localOffset });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}
async function readEntry(bytes, entry) {
  const local = entry.localOffset;
  const nameLength = readU16(bytes, local + 26);
  const extraLength = readU16(bytes, local + 28);
  const start = local + 30 + nameLength + extraLength;
  const data = bytes.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return data;
  if (entry.method === 8) return inflateRaw(data);
  throw new Error("Excel 的壓縮方式不支援");
}
function entryText(files, name) {
  const file = files.get(name.replace(/^\/+/, ""));
  if (!file) return "";
  // Excel 產生器可替元素加上 x: 等命名空間前綴；文字內容與屬性保持原樣。
  return textDecoder.decode(file).replace(/(<\/?)[A-Za-z_][\w.-]*:/g, "$1");
}
function sharedStrings(xml) {
  const values = [];
  for (const item of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
    const text = [...item[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
      .map((part) => decodeXml(part[1]))
      .join("");
    values.push(text);
  }
  return values;
}
function sheetRows(xml, strings) {
  const rows = [];
  for (const row of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = [];
    for (const cell of row[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = cell[1].match(/\br="([A-Z]+)\d+"/)?.[1] || colName(cells.length);
      const type = cell[1].match(/\bt="([^"]+)"/)?.[1] || "";
      const index = colIndex(ref);
      while (cells.length < index) cells.push("");
      const content = cell[2] || "";
      const inline = content.match(/<t\b[^>]*>([\s\S]*?)<\/t>/);
      const value = content.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      if (type === "s") cells[index] = strings[Number(value)] ?? "";
      else if (type === "inlineStr" && inline) cells[index] = decodeXml(inline[1]);
      else if (value == null || value === "") cells[index] = "";
      else if (type === "str") cells[index] = decodeXml(value);
      else {
        const number = Number(value);
        cells[index] = Number.isFinite(number) ? number : decodeXml(value);
      }
    }
    rows.push(cells);
  }
  return rows;
}

/** 讀第一個工作表。儲存格可以是文字或數字。 */
export async function xlsxToRows(bytes) {
  const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const entries = unzip(source);
  const files = new Map();
  for (const entry of entries) files.set(entry.name.replace(/\\/g, "/"), await readEntry(source, entry));
  const workbook = entryText(files, "xl/workbook.xml");
  if (!workbook) throw new Error("Excel 裡沒有工作表");
  const rels = entryText(files, "xl/_rels/workbook.xml.rels");
  const sheetId = workbook.match(/<sheet\b[^>]*\br:id="([^"]+)"/)?.[1];
  // Relationship 的屬性順序不固定，不能假設 Id 一定在 Target 前面。
  const relationship = [...rels.matchAll(/<Relationship\b[^>]*\/?>/g)]
    .find(([tag]) => tag.match(/\bId="([^"]+)"/)?.[1] === sheetId)?.[0];
  const target = sheetId
    ? relationship?.match(/\bTarget="([^"]+)"/)?.[1]
    : "worksheets/sheet1.xml";
  if (!target) throw new Error("Excel 裡沒有工作表");
  const sheetPath = target.startsWith("/")
    ? target.slice(1)
    : `xl/${target.replace(/^\.\//, "")}`;
  const sheet = entryText(files, sheetPath);
  if (!sheet) throw new Error("Excel 裡沒有工作表");
  const strings = sharedStrings(entryText(files, "xl/sharedStrings.xml"));
  return sheetRows(sheet, strings);
}
