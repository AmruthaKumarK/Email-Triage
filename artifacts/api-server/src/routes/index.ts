import { Router, type IRouter } from "express";
import healthRouter from "./health";
import envRouter from "./env";
import sessionsRouter from "./sessions";
import resultsRouter from "./results";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/env", envRouter);
router.use(sessionsRouter);
router.use(resultsRouter);

export default router;
