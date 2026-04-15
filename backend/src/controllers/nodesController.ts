import { Request, Response } from "express"
import { nodes } from "../data/mockData"

export function getNodes(_req: Request, res: Response) {
  res.json(nodes)
}

export function getNodeById(req: Request, res: Response) {
  const node = nodes.find(n => n.id === req.params.id)
  if (!node) return res.status(404).json({ error: "Node not found" })
  res.json(node)
}