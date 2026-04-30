import fs from "node:fs";
import path from "node:path";
import { finished } from "node:stream/promises";

const mkdir = fs.promises.mkdir;
const stat = fs.promises.stat;

export type JsonlFileExportArtifact = {
  fileName: string;
  filePath: string;
  bytes: number;
};

export class JsonlFileExportWriter {
  private bytes = 0;

  private constructor(
    private readonly stream: fs.WriteStream,
    private readonly fileName: string,
    private readonly filePath: string
  ) {}

  static async open(exportDir: string, fileName: string): Promise<JsonlFileExportWriter> {
    await ensureDir(exportDir);
    const filePath = path.join(exportDir, fileName);
    return new JsonlFileExportWriter(fs.createWriteStream(filePath, { encoding: "utf8" }), fileName, filePath);
  }

  async writeRecord(record: unknown): Promise<void> {
    const line = JSON.stringify(record) + "\n";
    this.bytes += Buffer.byteLength(line, "utf8");
    await writeLine(this.stream, line);
  }

  async finish(): Promise<JsonlFileExportArtifact> {
    this.stream.end();
    await finished(this.stream);
    return {
      fileName: this.fileName,
      filePath: this.filePath,
      bytes: this.bytes,
    };
  }

  destroy(): void {
    this.stream.destroy();
  }
}

export function logExportFileName(accountId: number, jobId: string): string {
  return `logs_account_${accountId}_${jobId}.jsonl`;
}

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  const st = await stat(dir);
  if (!st.isDirectory()) throw new Error(`EXPORT_DIR is not a directory: ${dir}`);
}

async function writeLine(stream: fs.WriteStream, line: string): Promise<void> {
  if (stream.write(line)) return;
  await new Promise<void>((resolve, reject) => {
    stream.once("drain", resolve);
    stream.once("error", reject);
  });
}
