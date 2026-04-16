import { Request, Response } from "express"
import { prisma } from "../data/db"

export async function getSessions(_req: Request, res: Response) {
  try {
    const sessions = await prisma.uploadSession.findMany()
    res.json(sessions)
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch upload sessions" })
  }
}

export async function initiateUpload(req: Request, res: Response) {
  const { filename, sizeBytes } = req.body
  if (!filename || !sizeBytes) {
    return res.status(400).json({ error: "filename and sizeBytes are required" })
  }

  try {
    const session = await prisma.uploadSession.create({
      data: {
        filename,
        sizeBytes,
        progress: 0,
        status: "in_progress",
      },
    })
    res.status(201).json(session)
  } catch (error) {
    res.status(500).json({ error: "Failed to initiate upload" })
  }
}

export async function completeUpload(req: Request, res: Response) {
  try {
    const session = await prisma.uploadSession.update({
      where: { id: req.params.id as string },
      data: {
        progress: 100,
        status: "completed",
      },
    })
    res.json(session)
  } catch (error) {
    res.status(404).json({ error: "Upload session not found" })
  }
}

export async function uploadData(req: Request, res: Response) {
  try {
    const id = req.params.id as string
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" })
    }
    
    const session = await prisma.uploadSession.update({
      where: { id },
      data: {
        progress: 100,
        status: "completed",
      },
    })
    
    res.json(session)
  } catch (error) {
    res.status(500).json({ error: "Failed to process upload" })
  }
}