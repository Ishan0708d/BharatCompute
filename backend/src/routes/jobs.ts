import { Router } from "express"
import { getJobs, getJobById, createJob, deleteJob } from "../controllers/jobsController"

const router = Router()

router.get("/", getJobs)
router.get("/:id", getJobById)
router.post("/", createJob)
router.delete("/:id", deleteJob)

export default router