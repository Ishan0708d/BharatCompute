import { Router } from "express"
import { getSessions, initiateUpload, completeUpload } from "../controllers/uploadsController"

const router = Router()

router.get("/", getSessions)
router.post("/initiate", initiateUpload)
router.patch("/:id/complete", completeUpload)

export default router