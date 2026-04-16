import { Request, Response } from "express"
import { prisma } from "../data/db"

export async function getNodes(_req: Request, res: Response) {
  try {
    const nodes = await prisma.node.findMany()
    res.json(nodes)
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch nodes" })
  }
}

export async function getNodeById(req: Request, res: Response) {
  try {
    const node = await prisma.node.findUnique({
      where: { id: req.params.id as string },
    })
    if (!node) return res.status(404).json({ error: "Node not found" })
    res.json(node)
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch node" })
  }
}