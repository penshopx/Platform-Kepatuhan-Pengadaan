import { Router, type IRouter } from "express";
import healthRouter from "./health";
import policyEngineRouter from "./policy-engine";
import procurementRouter from "./procurement";

const router: IRouter = Router();

router.use(healthRouter);
router.use(policyEngineRouter);
router.use(procurementRouter);

export default router;
