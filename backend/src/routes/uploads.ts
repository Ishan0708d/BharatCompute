import { Router } from "express"
import { getSessions, initiateUpload, completeUpload, uploadData } from "../controllers/uploadsController"
import { upload } from "../middleware/upload"

const router = Router()

router.get("/", getSessions)
router.post("/initiate", initiateUpload)
router.patch("/:id/complete", completeUpload)
router.post("/:id/data", upload.single("file"), uploadData)

export default router