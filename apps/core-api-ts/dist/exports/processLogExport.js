import { JsonlFileExportWriter, logExportFileName } from "./jsonlFileExportWriter.js";
import { toLogExportFilters } from "./logExportFilters.js";
import { toLogExportRecord } from "./logExportMapper.js";
import { fetchLogExportPage } from "./logExportRepository.js";
const PAGE_SIZE = 500;
export async function processLogExport(deps, jobId, data) {
    const filters = toLogExportFilters(data);
    const writer = await JsonlFileExportWriter.open(deps.env.EXPORT_DIR, logExportFileName(data.accountId, jobId));
    try {
        let cursor = null;
        while (true) {
            const page = await fetchLogExportPage(deps.db, { filters, cursor, limit: PAGE_SIZE });
            if (page.rows.length === 0)
                break;
            for (const row of page.rows) {
                await writer.writeRecord(toLogExportRecord(row));
            }
            cursor = page.nextCursor;
        }
    }
    catch (e) {
        writer.destroy();
        throw e;
    }
    const artifact = await writer.finish();
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + deps.env.EXPORT_TTL_HOURS * 60 * 60 * 1000);
    return {
        format: "jsonl",
        filePath: artifact.filePath,
        fileName: artifact.fileName,
        bytes: artifact.bytes,
        createdAt: createdAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
    };
}
