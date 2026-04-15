import { Request, Response } from "express"
import { uploadSessions, UploadSession } from "../data/mockData"
import { v4 as uuidv4 } from "uuid"

export function getSessions(_req: Request, res: Response) {
  res.json(uploadSessions)
}

export function initiateUpload(req: Request, res: Response) {
  const { filename, sizeBytes } = req.body
  if (!filename || !sizeBytes) {
    return res.status(400).json({ error: "filename and sizeBytes are required" })
  }

  const session: UploadSession = {
    id: uuidv4(),
    filename,
    sizeBytes,
    progress: 0,
    status: "in_progress",
    createdAt: new Date().toISOString(),
  }

  uploadSessions.push(session)
  res.status(201).json(session)
}

export function completeUpload(req: Request, res: Response) {
  const session = uploadSessions.find(s => s.id === req.params.id)
  if (!session) return res.status(404).json({ error: "Upload session not found" })
  session.progress = 100
  session.status = "completed"
  res.json(session)
}