import app from "./app";
import { logger } from "./lib/logger";
import { loadKb } from "./lib/kb-store";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Load KB from Yandex Disk after server starts accepting requests
  loadKb().catch((kbErr) => {
    logger.error({ err: kbErr }, "KB initial load failed — call POST /api/refresh-kb to retry");
  });
});
