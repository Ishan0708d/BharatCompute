import { Server } from "socket.io"
import { prisma } from "./data/db"

export function startTelemetryBroadcaster(io: Server) {
  console.log("Starting WebSocket Telemetry Broadcaster...")

  setInterval(async () => {
    try {
      // Fetch pure DB state
      const [nodesData, jobsData] = await Promise.all([
        prisma.node.findMany(),
        prisma.job.findMany()
      ])

      if (!nodesData?.length) return

      // Compute physical telemetry matching the jobs assigned to nodes
      const enrichedNodes = nodesData.map((node) => {
        if (node.status === "offline") {
          return { name: node.name, status: "offline", gpu: 0, memory: 0, temp: 0, power: 0 }
        }

        const nodeJobs = jobsData.filter(j => j.nodeId === node.id)
        const usedGpus = nodeJobs.reduce((sum, j) => sum + j.gpus, 0)
        let gpuPercent = Math.round((usedGpus / node.totalGpus) * 100)
        if (gpuPercent > 100) gpuPercent = 100

        const isIdle = gpuPercent === 0
        const randomBetween = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min

        return {
          name: node.name,
          status: "online",
          gpu: gpuPercent,
          memory: isIdle ? randomBetween(5, 10) : randomBetween(40, 80),
          temp: isIdle ? randomBetween(35, 45) : randomBetween(65, 85),
          power: isIdle ? randomBetween(30, 50) : randomBetween(200, 350)
        }
      })

      // Blast to all connected React clients seamlessly
      io.emit("telemetry_update", enrichedNodes)

    } catch (error) {
      console.error("Telemetry broadcast error:", error)
    }
  }, 1500)
} 
