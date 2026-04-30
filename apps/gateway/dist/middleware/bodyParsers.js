import express from "express";
export function bodyParsers(maxBodyBytes) {
    return [
        express.json({ limit: maxBodyBytes, strict: false }),
        express.text({ limit: maxBodyBytes, type: ["text/*", "text/plain"] }),
    ];
}
