/**
 * Singleton KB store.
 * Fetches the xlsx from Yandex Disk on server startup and caches it in memory.
 * Call loadKb() once at startup; refreshKb() to hot-reload.
 */
import { logger } from "./logger";
import { downloadKbFile } from "./ydisk";
import { buildKbFromBuffer } from "./kb-builder";

export interface KbData {
  matchKb: string;
  negotiationKb: Record<string, string>;
  programCount: number;
  lastLoaded: Date | null;
  loadError: string | null;
}

let store: KbData = {
  matchKb: "",
  negotiationKb: {},
  programCount: 0,
  lastLoaded: null,
  loadError: "База знаний ещё не загружена. Сервер запускается.",
};

export function getKb(): KbData {
  return store;
}

export async function loadKb(): Promise<void> {
  logger.info("KB load: downloading from Yandex Disk…");
  try {
    const buf = await downloadKbFile();
    const built = buildKbFromBuffer(buf);
    store = {
      ...built,
      lastLoaded: new Date(),
      loadError: null,
    };
    logger.info({ programCount: built.programCount }, "KB load: success");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    store = { ...store, loadError: msg };
    logger.error({ err }, "KB load: failed");
    throw err;
  }
}

export async function refreshKb(): Promise<void> {
  await loadKb();
}
