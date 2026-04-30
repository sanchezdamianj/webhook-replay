import express from "express";

const app = express();
const port = Number.parseInt(process.env.PORT ?? "4000", 10);

app.disable("x-powered-by");
app.use(express.text({ type: "*/*", limit: "2mb" }));

let last = null;

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "receiver" });
});

app.post("/echo", (req, res) => {
  last = {
    received_at: new Date().toISOString(),
    method: req.method,
    path: req.originalUrl,
    headers: req.headers,
    body: req.body ?? "",
  };
  res.status(200).json({ ok: true });
});

app.get("/last", (_req, res) => {
  res.json(last ?? { ok: false, error: "no_requests_yet" });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`receiver listening on ${port}`);
});

