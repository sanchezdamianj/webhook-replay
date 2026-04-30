function parseIsoDate(s) {
    if (!s)
        return null;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
}
export function toLogExportFilters(data) {
    return {
        accountId: data.accountId,
        destinationId: data.destinationId ?? null,
        receivedAtFrom: parseIsoDate(data.receivedAtFrom),
        receivedAtTo: parseIsoDate(data.receivedAtTo),
    };
}
