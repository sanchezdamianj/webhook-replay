import type { RequestHandler } from "express";
import express from "express";

export function bodyParsers(maxBodyBytes: number): RequestHandler[] {
  return [
    express.json({ limit: maxBodyBytes, strict: false }),
    express.text({ limit: maxBodyBytes, type: ["text/*", "text/plain"] }),
  ];
}

