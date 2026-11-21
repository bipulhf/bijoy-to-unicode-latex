import express from "express";
import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { convertBuffer, InvalidDocxError } from "./index.js";

class UnsupportedFileError extends Error {}

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === ".docx") {
      cb(null, true);
    } else {
      cb(new UnsupportedFileError("Only .docx files are supported"));
    }
  },
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.join(__dirname, "../web");

// The page calls /converter/api/convert. Serve both with and without that
// prefix so it works behind a proxy that keeps or strips it, and locally.
// Separate mounts: with the ["/", "/converter"] array, Express 5 answered only
// "/" itself at the root and returned 404 for every file there.
app.use("/converter", express.static(webDir));
app.use("/", express.static(webDir));

app.post(
  ["/api/convert", "/converter/api/convert"],
  upload.single("file"),
  async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    try {
      const result = await convertBuffer(req.file.buffer);
      res.json(result);
    } catch (err) {
      if (err instanceof InvalidDocxError) {
        res.status(400).json({ error: err.message });
        return;
      }
      console.error(err);
      res.status(500).json({ error: "Conversion failed" });
    }
  },
);

// Upload errors (wrong type, too large) must reach the page as JSON, not as
// Express's default HTML error page.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    const message =
      err.code === "LIMIT_FILE_SIZE" ? "File is larger than 50 MB" : err.message;
    res.status(status).json({ error: message });
    return;
  }
  if (err instanceof UnsupportedFileError) {
    res.status(400).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const port = Number(process.env.PORT) || 3001;
const server = app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

process.on("SIGINT", () => {
  console.log("\nShutting down…");
  server.close(() => process.exit(0));
});

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});
