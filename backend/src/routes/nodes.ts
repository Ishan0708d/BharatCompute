import { Router } from "express"
import { getNodes, getNodeById } from "../controllers/nodesController"

const router = Router()

router.get("/", getNodes)
router.get("/:id", getNodeById)

export default router