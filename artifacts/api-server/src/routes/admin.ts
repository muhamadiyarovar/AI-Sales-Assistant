import { Router, type IRouter } from "express";
import { getKb, refreshKb } from "../lib/kb-store";

const router: IRouter = Router();

/** GET /api/kb-status — returns current KB state */
router.get("/kb-status", (_req, res) => {
  const kb = getKb();
  res.json({
    ok: kb.loadError === null,
    programCount: kb.programCount,
    lastLoaded: kb.lastLoaded,
    error: kb.loadError,
  });
});

/** POST /api/refresh-kb — hot-reload KB from Yandex Disk */
router.post("/refresh-kb", async (_req, res) => {
  try {
    await refreshKb();
    const kb = getKb();
    res.json({
      ok: true,
      programCount: kb.programCount,
      lastLoaded: kb.lastLoaded,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(502).json({ ok: false, error: message });
  }
});

export default router;
