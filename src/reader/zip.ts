import { inflateRaw } from "node:zlib";
import { promisify } from "node:util";
import { InvalidDocxError } from "../types.js";

const inflate = promisify(inflateRaw);

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const EOCD_SIZE = 22;
const MAX_COMMENT = 0xffff;

interface ZipEntry {
  method: number;
  encrypted: boolean;
  compressedSize: number;
  localOffset: number;
}

/**
 * Minimal ZIP reader for .docx files: stored and deflated entries, no ZIP64
 * or encryption. Uses node:zlib so the package needs no unzip dependency.
 */
export class ZipArchive {
  private constructor(
    private readonly data: Buffer,
    private readonly entries: Map<string, ZipEntry>,
  ) {}

  static open(data: Buffer): ZipArchive {
    try {
      return new ZipArchive(data, readCentralDirectory(data));
    } catch {
      throw new InvalidDocxError("File is not a valid ZIP archive");
    }
  }

  /** Text of an entry, or null when it is missing; at most maxBytes long. */
  async readText(path: string, maxBytes: number): Promise<string | null> {
    const entry = this.entries.get(path);
    if (!entry) return null;
    const bytes = await this.readBytes(path, entry, maxBytes);
    return new TextDecoder("utf-8").decode(bytes);
  }

  private async readBytes(path: string, entry: ZipEntry, maxBytes: number): Promise<Buffer> {
    const unreadable = new InvalidDocxError(`Cannot read ${path} from the archive`);
    const tooLarge = new InvalidDocxError(`${path} is too large to process`);
    if (entry.encrypted) throw unreadable;

    const at = entry.localOffset;
    if (at + 30 > this.data.length || this.data.readUInt32LE(at) !== LOCAL_SIGNATURE) {
      throw unreadable;
    }
    const start = at + 30 + this.data.readUInt16LE(at + 26) + this.data.readUInt16LE(at + 28);
    const end = start + entry.compressedSize;
    if (end > this.data.length) throw unreadable;
    const raw = this.data.subarray(start, end);

    if (entry.method === 0) {
      if (raw.length > maxBytes) throw tooLarge;
      return raw;
    }
    if (entry.method !== 8) throw unreadable;
    try {
      return await inflate(raw, { maxOutputLength: maxBytes });
    } catch (error) {
      throw (error as { code?: string }).code === "ERR_BUFFER_TOO_LARGE" ? tooLarge : unreadable;
    }
  }
}

function readCentralDirectory(data: Buffer): Map<string, ZipEntry> {
  const eocd = findEndOfCentralDirectory(data);
  const count = data.readUInt16LE(eocd + 10);
  let pos = data.readUInt32LE(eocd + 16);

  const entries = new Map<string, ZipEntry>();
  for (let i = 0; i < count; i++) {
    if (data.readUInt32LE(pos) !== CENTRAL_SIGNATURE) throw new Error("bad central directory");
    const flags = data.readUInt16LE(pos + 8);
    const nameLength = data.readUInt16LE(pos + 28);
    const nameStart = pos + 46;
    const name = data.toString(flags & 0x800 ? "utf8" : "latin1", nameStart, nameStart + nameLength);
    entries.set(name, {
      method: data.readUInt16LE(pos + 10),
      encrypted: (flags & 0x1) !== 0,
      compressedSize: data.readUInt32LE(pos + 20),
      localOffset: data.readUInt32LE(pos + 42),
    });
    pos = nameStart + nameLength + data.readUInt16LE(pos + 30) + data.readUInt16LE(pos + 32);
  }
  return entries;
}

function findEndOfCentralDirectory(data: Buffer): number {
  const last = data.length - EOCD_SIZE;
  for (let i = last; i >= 0 && i >= last - MAX_COMMENT; i--) {
    if (data.readUInt32LE(i) === EOCD_SIGNATURE) return i;
  }
  throw new Error("no end of central directory");
}
