import { Request, Response } from "express"
import { prisma } from "../data/db"

export async function getJobs(_req: Request, res: Response) {
  try {
    const jobs = await prisma.job.findMany()
    res.json(jobs)
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch jobs" })
  }
}

export async function getJobById(req: Request, res: Response) {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id as string },
    })
    if (!job) return res.status(404).json({ error: "Job not found" })
    res.json(job)
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch job" })
  }
}

export async function createJob(req: Request, res: Response) {
  const { name, framework, gpus, nodeId, datasetId } = req.body
  if (!name || !framework || !gpus) {
    return res.status(400).json({ error: "name, framework and gpus are required" })
  }

  try {
    const newJob = await prisma.job.create({
      data: {
        name,
        framework,
        gpus,
        nodeId: nodeId || null,
        datasetId: datasetId || null,
        status: "pending",
      },
    })
    res.status(201).json(newJob)
  } catch (error) {
    res.status(500).json({ error: "Failed to create job" })
  }
}

export async function deleteJob(req: Request, res: Response) {
  try {
    await prisma.job.delete({
      where: { id: req.params.id as string },
    })
    res.json({ message: "Job cancelled" })
  } catch (error) {
    res.status(404).json({ error: "Job not found or could not be deleted" })
  }
}

export async function updateJob(req: Request, res: Response) {
  try {
    const job = await prisma.job.update({
      where: { id: req.params.id as string },
      data: req.body,
    })
    res.json(job)
  } catch (error) {
    res.status(400).json({ error: "Failed to update job" })
  }
}