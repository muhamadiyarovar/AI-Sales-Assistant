import { Router, type IRouter } from "express";
import healthRouter from "./health";
import matchRouter from "./match";
import negotiateRouter from "./negotiate";

const router: IRouter = Router();

router.use(healthRouter);
router.use(matchRouter);
router.use(negotiateRouter);

export default router;
