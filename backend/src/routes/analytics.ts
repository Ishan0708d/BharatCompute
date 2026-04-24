import { Router } from "express"
import {
  getAnalyticsSummary,
  predictJobDuration,
  getNodeTelemetryHistory,
  getDatasetEda,
} from "../controllers/analyticsController"

const router = Router()

// GET /api/analytics/summary — descriptive analytics aggregation
router.get("/summary", getAnalyticsSummary)

// GET /api/analytics/predict?gpus=N&datasetSize=S — linear regression prediction
router.get("/predict", predictJobDuration)

// GET /api/analytics/telemetry-history?nodeName=X&minutes=N — time-series query
router.get("/telemetry-history", getNodeTelemetryHistory)

// GET /api/analytics/eda/:id — CSV profiling / EDA report for an uploaded dataset
router.get("/eda/:id", getDatasetEda)

export default router
