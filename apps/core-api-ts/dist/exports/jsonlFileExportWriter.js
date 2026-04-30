import fs from "node:fs";
import path from "node:path";
import { finished } from "node:stream/promises";
const mkdir = fs.promises.mkdir;
const stat = fs.promises.stat;
export class JsonlFileExportWriter {
    stream;
    fileName;
    filePath;
    bytes = 0;
    constructor(stream, fileName, filePath) {
        this.stream = stream;
        this.fileName = fileName;
        this.filePath = filePath;
    }
    static async open(exportDir, fileName) {
        await ensureDir(exportDir);
        const filePath = path.join(exportDir, fileName);
        return new JsonlFileExportWriter(fs.createWriteStream(filePath, { encoding: "utf8" }), fileName, filePath);
    }
    async writeRecord(record) {
        const line = JSON.stringify(record) + "\n";
        this.bytes += Buffer.byteLength(line, "utf8");
        await writeLine(this.stream, line);
    }
    async finish() {
        this.stream.end();
        await finished(this.stream);
        return {
            fileName: this.fileName,
            filePath: this.filePath,
            bytes: this.bytes,
        };
    }
    destroy() {
        this.stream.destroy();
    }
}
export function logExportFileName(accountId, jobId) {
    return `logs_account_${accountId}_${jobId}.jsonl`;
}
async function ensureDir(dir) {
    await mkdir(dir, { recursive: true });
    const st = await stat(dir);
    if (!st.isDirectory())
        throw new Error(`EXPORT_DIR is not a directory: ${dir}`);
}
async function writeLine(stream, line) {
    if (stream.write(line))
        return;
    await new Promise((resolve, reject) => {
        stream.once("drain", resolve);
        stream.once("error", reject);
    });
}
