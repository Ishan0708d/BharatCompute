import { Server } from "socket.io"
import { prisma } from "./data/db"

// ─────────────────────────────────────────────────────────────────────────────
// Telemetry Broadcaster
//
// DSBDA concepts:
//   • Real-time streaming data ingestion (every 1.5s = continuous data stream)
//   • Time-series data storage (TelemetrySnapshot table acts as a data warehouse)
//   • Write-behind pattern: emit first, persist asynchronously (no latency impact)
//   • Data retention window: prune snapshots older than 24h (sliding window concept)
// ─────────────────────────────────────────────────────────────────────────────

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

      // ── Persist to TelemetrySnapshot (time-series storage) ──────────────
      // Write-behind: we already emitted above, so this DB write is fire-and-forget.
      // Each online node produces one snapshot row per tick → continuous data stream.
      const onlineNodes = enrichedNodes.filter(n => n.status === "online")
      if (onlineNodes.length > 0) {
        await prisma.telemetrySnapshot.createMany({
          data: onlineNodes.map(n => ({
            nodeName: n.name,
            gpu: n.gpu,
            memory: n.memory,
            temp: n.temp,
            power: n.power,
          }))
        })

        // ── Retention: delete snapshots older than 24 hours ──────────────
        // Sliding window — keeps DB size bounded while preserving a full day
        // of historical data for trend analysis and anomaly detection.
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
        await prisma.telemetrySnapshot.deleteMany({
          where: { recordedAt: { lt: cutoff } }
        })
      }

    } catch (error) {
      console.error("Telemetry broadcast error:", error)
    }
  }, 1500)
}

