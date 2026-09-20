import { Router, type IRouter } from "express";
import healthRouter from "./health";
import policyEngineRouter from "./policy-engine";
import procurementRouter from "./procurement";
import legalAdminRouter from "./legal-admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(policyEngineRouter);
router.use(procurementRouter);
router.use(legalAdminRouter);

export default router;
