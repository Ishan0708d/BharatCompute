import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import { createServer } from "http"
import { Server } from "socket.io"

import jobsRouter from "./routes/jobs"
import nodesRouter from "./routes/nodes"
import uploadsRouter from "./routes/uploads"
import { startTelemetryBroadcaster } from "./telemetry"

dotenv.config()

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: "*" }
})

export { io } // Export for other files if needed

const PORT = process.env.PORT || 4000

app.use(cors())
app.use(express.json())

app.use("/api/jobs", jobsRouter)
app.use("/api/nodes", nodesRouter)
app.use("/api/uploads", uploadsRouter)

app.get("/api/health", (_, res) => {
  res.json({ status: "ok", service: "BharatCompute API", timestamp: new Date().toISOString() })
})

// Start the websocket telemetry engine
startTelemetryBroadcaster(io)

httpServer.listen(PORT, () => {
  console.log(`BharatCompute backend running on http://localhost:${PORT}`)
})