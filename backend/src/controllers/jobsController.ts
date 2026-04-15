import { Request, Response } from "express"
import { jobs, Job } from "../data/mockData"
import { v4 as uuidv4 } from "uuid"

export function getJobs(_req: Request, res: Response) {
  res.json(jobs)
}

export function getJobById(req: Request, res: Response) {
  const job = jobs.find(j => j.id === req.params.id)
  if (!job) return res.status(404).json({ error: "Job not found" })
  res.json(job)
}

export function createJob(req: Request, res: Response) {
  const { name, framework, gpus, nodeId } = req.body
  if (!name || !framework || !gpus) {
    return res.status(400).json({ error: "name, framework and gpus are required" })
  }

  const newJob: Job = {
    id: uuidv4(),
    name,
    framework,
    gpus,
    nodeId: nodeId || null,
    status: "pending",
    submittedAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
  }

  jobs.push(newJob)
  res.status(201).json(newJob)
}

export function deleteJob(req: Request, res: Response) {
  const index = jobs.findIndex(j => j.id === req.params.id)
  if (index === -1) return res.status(404).json({ error: "Job not found" })
  jobs.splice(index, 1)
  res.json({ message: "Job cancelled" })
}