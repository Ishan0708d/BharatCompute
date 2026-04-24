import { Request, Response } from "express"
import { prisma } from "../data/db"
import path from "path"
import fs from "fs"
import { parse } from "csv-parse/sync"
import { UPLOAD_DIR } from "../middleware/upload"

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/summary
// Descriptive analytics: aggregates over all historical job + node data.
// DSBDA concept: Data summarization, descriptive statistics, frequency distribution.
// ─────────────────────────────────────────────────────────────────────────────
export async function getAnalyticsSummary(_req: Request, res: Response) {
  try {
    const [jobs, uploads] = await Promise.all([
      prisma.job.findMany(),
      prisma.uploadSession.findMany(),
    ])

    // --- Framework Distribution (Frequency Distribution) ---
    const frameworkCounts: Record<string, number> = {}
    for (const job of jobs) {
      frameworkCounts[job.framework] = (frameworkCounts[job.framework] || 0) + 1
    }

    // --- Pipeline Stage Distribution ---
    const stageCounts: Record<string, number> = {}
    for (const job of jobs) {
      stageCounts[job.stage] = (stageCounts[job.stage] || 0) + 1
    }

    // --- Job Status Distribution ---
    const statusCounts: Record<string, number> = {}
    for (const job of jobs) {
      statusCounts[job.status] = (statusCounts[job.status] || 0) + 1
    }

    // --- Job Duration Statistics (Descriptive Stats) ---
    // Only consider jobs that have both startedAt and completedAt
    const completedJobs = jobs.filter((j) => j.startedAt && j.completedAt)
    const durations = completedJobs.map(
      (j) =>
        (new Date(j.completedAt!).getTime() - new Date(j.startedAt!).getTime()) / 1000 // seconds
    )
    const avgDuration = durations.length
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0
    const maxDuration = durations.length ? Math.max(...durations) : 0
    const minDuration = durations.length ? Math.min(...durations) : 0
    // Standard deviation
    const stdDev = durations.length
      ? Math.sqrt(
          durations.map((d) => Math.pow(d - avgDuration, 2)).reduce((a, b) => a + b, 0) /
            durations.length
        )
      : 0

    // --- GPU Demand (avg GPUs requested per job) ---
    const avgGpuDemand = jobs.length
      ? jobs.reduce((a, j) => a + j.gpus, 0) / jobs.length
      : 0

    // --- Dataset Size Distribution (for histogram bins) ---
    const uploadSizes = uploads.map((u) => u.sizeBytes)
    const totalDataIngested = uploadSizes.reduce((a, b) => a + b, 0)

    // Bin sizes into histogram buckets: <1MB, 1-10MB, 10-100MB, >100MB
    const sizeBins = {
      "<1MB": uploadSizes.filter((s) => s < 1e6).length,
      "1-10MB": uploadSizes.filter((s) => s >= 1e6 && s < 10e6).length,
      "10-100MB": uploadSizes.filter((s) => s >= 10e6 && s < 100e6).length,
      ">100MB": uploadSizes.filter((s) => s >= 100e6).length,
    }

    // --- Job Throughput Over Time (last 7 days, daily buckets) ---
    const now = new Date()
    const throughput: { date: string; count: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const day = new Date(now)
      day.setDate(day.getDate() - i)
      const label = day.toLocaleDateString("en-IN", { month: "short", day: "numeric" })
      const count = jobs.filter((j) => {
        const submitted = new Date(j.submittedAt)
        return submitted.toDateString() === day.toDateString()
      }).length
      throughput.push({ date: label, count })
    }

    res.json({
      totalJobs: jobs.length,
      totalDatasets: uploads.length,
      totalDataIngested,
      frameworkCounts,
      stageCounts,
      statusCounts,
      durationStats: {
        avg: Math.round(avgDuration),
        max: Math.round(maxDuration),
        min: Math.round(minDuration),
        stdDev: Math.round(stdDev),
        sampleSize: durations.length,
      },
      avgGpuDemand: Math.round(avgGpuDemand * 10) / 10,
      sizeBins,
      throughput,
    })
  } catch (error) {
    res.status(500).json({ error: "Failed to compute analytics" })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/predict?gpus=N&datasetSize=S
// Predictive analytics: estimates job duration using simple linear regression.
// DSBDA concept: Predictive modeling, regression, machine learning pipeline.
//
// Model: duration = β0 + β1*gpus + β2*datasetSizeMB
// We fit this using the Ordinary Least Squares (OLS) closed-form solution
// on all historically completed jobs where startedAt and completedAt exist.
// ─────────────────────────────────────────────────────────────────────────────
export async function predictJobDuration(req: Request, res: Response) {
  try {
    const gpus = parseFloat(req.query.gpus as string) || 4
    const datasetSizeMB = parseFloat(req.query.datasetSize as string) || 0

    // Fetch completed jobs that have timing data AND were linked to a dataset
    const completedJobs = await prisma.job.findMany({
      where: { startedAt: { not: null }, completedAt: { not: null } },
      include: { dataset: true },
    })

    // Build training data: [gpus, datasetSizeMB, durationSeconds]
    const trainingData = completedJobs.map((j) => {
      const durationSec =
        (new Date(j.completedAt!).getTime() - new Date(j.startedAt!).getTime()) / 1000
      const dsMB = j.dataset ? j.dataset.sizeBytes / 1e6 : 0
      return { gpus: j.gpus, dsMB, durationSec }
    })

    if (trainingData.length < 2) {
      // Not enough data to fit a model — return a heuristic estimate instead
      // Heuristic: base_time / gpus * (1 + datasetFactor)
      const baseSec = 300 // 5 min baseline
      const estimated = Math.round((baseSec / gpus) * (1 + datasetSizeMB / 100))
      return res.json({
        estimatedSeconds: estimated,
        confidence: "low",
        modelUsed: "heuristic",
        trainingPoints: 0,
        note: "Insufficient historical data. Showing heuristic estimate.",
      })
    }

    // ─── Simple Multiple Linear Regression (2 features) ───
    // Using gradient-free closed-form OLS for 2 variables (gpus, dsMB):
    // We treat each feature independently using univariate regressions
    // then combine — a simplified approach suitable for demonstration.

    const n = trainingData.length
    const sumGpus = trainingData.reduce((a, d) => a + d.gpus, 0)
    const sumDs = trainingData.reduce((a, d) => a + d.dsMB, 0)
    const sumDur = trainingData.reduce((a, d) => a + d.durationSec, 0)
    const sumGpuSq = trainingData.reduce((a, d) => a + d.gpus ** 2, 0)
    const sumDsSq = trainingData.reduce((a, d) => a + d.dsMB ** 2, 0)
    const sumGpuDur = trainingData.reduce((a, d) => a + d.gpus * d.durationSec, 0)
    const sumDsDur = trainingData.reduce((a, d) => a + d.dsMB * d.durationSec, 0)

    // OLS slope for gpus: β1 = (n*ΣXY - ΣX*ΣY) / (n*ΣX² - (ΣX)²)
    const betaGpus =
      (n * sumGpuDur - sumGpus * sumDur) / (n * sumGpuSq - sumGpus ** 2 + 1e-9)

    // OLS slope for dataset size: β2
    const betaDs =
      (n * sumDsDur - sumDs * sumDur) / (n * sumDsSq - sumDs ** 2 + 1e-9)

    // Intercept: β0 = (ΣY - β1*ΣX1 - β2*ΣX2) / n
    const beta0 = (sumDur - betaGpus * sumGpus - betaDs * sumDs) / n

    const predictedSec = beta0 + betaGpus * gpus + betaDs * datasetSizeMB
    const estimated = Math.max(30, Math.round(predictedSec)) // floor at 30s

    // R² score to express confidence
    const meanDur = sumDur / n
    const ssTot = trainingData.reduce((a, d) => a + (d.durationSec - meanDur) ** 2, 0)
    const ssRes = trainingData.reduce((a, d) => {
      const pred = beta0 + betaGpus * d.gpus + betaDs * d.dsMB
      return a + (d.durationSec - pred) ** 2
    }, 0)
    const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0
    const confidence = r2 > 0.7 ? "high" : r2 > 0.4 ? "medium" : "low"

    res.json({
      estimatedSeconds: estimated,
      confidence,
      modelUsed: "OLS linear regression",
      trainingPoints: n,
      r2: Math.round(r2 * 100) / 100,
      coefficients: {
        intercept: Math.round(beta0),
        gpuCoeff: Math.round(betaGpus * 100) / 100,
        datasetCoeff: Math.round(betaDs * 100) / 100,
      },
    })
  } catch (error) {
    res.status(500).json({ error: "Failed to compute prediction" })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/telemetry-history?nodeName=X&minutes=N
// Time-series analytics: fetch and aggregate stored telemetry snapshots.
// DSBDA concept: Time-Series Data, Data Warehousing, Sliding Window Aggregation.
//
// Returns the last N minutes of data for a given node, grouped into 1-minute
// buckets (avg per bucket) to reduce data volume for charting.
// ─────────────────────────────────────────────────────────────────────────────
export async function getNodeTelemetryHistory(req: Request, res: Response) {
  try {
    const nodeName = req.query.nodeName as string | undefined
    const minutes = Math.min(parseInt(req.query.minutes as string) || 60, 1440) // max 24h

    const since = new Date(Date.now() - minutes * 60 * 1000)

    const where = nodeName
      ? { nodeName, recordedAt: { gte: since } }
      : { recordedAt: { gte: since } }

    const snapshots = await prisma.telemetrySnapshot.findMany({
      where,
      orderBy: { recordedAt: "asc" },
    })

    // ── Aggregate into 1-minute buckets ───────────────────────────────────
    // This mirrors the MapReduce reduce step: group by key (minute), then average.
    // In a real Hadoop/Spark job, this would be a GROUP BY with aggregations.
    type Bucket = { gpu: number[]; memory: number[]; temp: number[]; power: number[] }
    const buckets: Record<string, Bucket> = {}

    for (const snap of snapshots) {
      // Round to the nearest minute → bucket key
      const d = new Date(snap.recordedAt)
      d.setSeconds(0, 0)
      const key = d.toISOString()

      if (!buckets[key]) buckets[key] = { gpu: [], memory: [], temp: [], power: [] }
      buckets[key].gpu.push(snap.gpu)
      buckets[key].memory.push(snap.memory)
      buckets[key].temp.push(snap.temp)
      buckets[key].power.push(snap.power)
    }

    const avg = (arr: number[]) =>
      arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0

    const aggregated = Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([timestamp, bucket]) => ({
        timestamp,
        gpu: avg(bucket.gpu),
        memory: avg(bucket.memory),
        temp: avg(bucket.temp),
        power: avg(bucket.power),
      }))

    // Summary stats across the window
    const allGpu = snapshots.map(s => s.gpu)
    const allTemp = snapshots.map(s => s.temp)
    const summaryStats = {
      avgGpu: avg(allGpu),
      peakGpu: allGpu.length ? Math.max(...allGpu) : 0,
      avgTemp: avg(allTemp),
      peakTemp: allTemp.length ? Math.max(...allTemp) : 0,
      totalSnapshots: snapshots.length,
      windowMinutes: minutes,
    }

    res.json({ history: aggregated, summaryStats })
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch telemetry history" })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/eda/:id
// Exploratory Data Analysis on an uploaded dataset.
// DSBDA concept: EDA, Data Preprocessing, Data Profiling, Data Quality Assessment.
//
// Reads the file from disk, parses it as CSV, and computes per-column statistics:
//   • data type inference (numeric vs categorical)
//   • null / missing value count and rate
//   • min, max, mean (for numeric columns)
//   • unique value count (for categorical columns)
//   • a 5-row preview of the raw data
// ─────────────────────────────────────────────────────────────────────────────
export async function getDatasetEda(req: Request, res: Response) {
  try {
    const sessionId = req.params.id as string

    // Find the upload session to get the original filename
    const session = await prisma.uploadSession.findUnique({
      where: { id: sessionId },
    })
    if (!session) {
      return res.status(404).json({ error: "Upload session not found" })
    }

    // Locate the file on disk — multer saves as `<timestamp>-<originalname>`
    // UPLOAD_DIR is imported from the middleware so both always point to the same place.
    if (!fs.existsSync(UPLOAD_DIR)) {
      return res.status(404).json({ error: "Uploads directory not found" })
    }

    const files = fs.readdirSync(UPLOAD_DIR)
    const match = files.find(f => f.endsWith(`-${session.filename}`))
    if (!match) {
      return res.status(404).json({
        error: "File not found on disk. Only datasets uploaded as CSV files can be profiled.",
        filename: session.filename,
      })
    }

    // Check extension — only profile CSV files
    if (!session.filename.toLowerCase().endsWith(".csv")) {
      return res.status(400).json({
        error: "EDA is only available for CSV files.",
        filename: session.filename,
        fileType: path.extname(session.filename),
      })
    }

    const filePath = path.join(UPLOAD_DIR, match)
    const rawContent = fs.readFileSync(filePath, "utf-8")

    // Parse CSV → array of row objects
    let rows: Record<string, string>[]
    try {
      rows = parse(rawContent, {
        columns: true,       // use first row as header
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      }) as Record<string, string>[]
    } catch {
      return res.status(400).json({ error: "Failed to parse CSV. Ensure the file is valid UTF-8 CSV." })
    }

    if (rows.length === 0) {
      return res.json({ filename: session.filename, rowCount: 0, columnCount: 0, columns: [], preview: [] })
    }

    const columnNames = Object.keys(rows[0])
    const rowCount = rows.length

    // ── Per-column profiling ───────────────────────────────────────────────
    const columnProfiles = columnNames.map((col) => {
      const rawValues = rows.map(r => r[col])
      const nullCount = rawValues.filter(v => v === null || v === undefined || v.trim() === "").length
      const validValues = rawValues.filter(v => v !== null && v !== undefined && v.trim() !== "")

      // Type inference: try parsing all valid values as numbers
      const numericValues = validValues
        .map(v => parseFloat(v))
        .filter(v => !isNaN(v))
      const isNumeric = numericValues.length === validValues.length && validValues.length > 0

      const profile: Record<string, unknown> = {
        name: col,
        dtype: isNumeric ? "numeric" : "categorical",
        nullCount,
        nullRate: rowCount > 0 ? Math.round((nullCount / rowCount) * 100) : 0,
        uniqueCount: new Set(validValues).size,
      }

      if (isNumeric && numericValues.length > 0) {
        const sum = numericValues.reduce((a, b) => a + b, 0)
        profile.min = Math.min(...numericValues)
        profile.max = Math.max(...numericValues)
        profile.mean = Math.round((sum / numericValues.length) * 100) / 100
        // Standard deviation
        const variance = numericValues.reduce((a, v) => a + (v - sum / numericValues.length) ** 2, 0) / numericValues.length
        profile.stdDev = Math.round(Math.sqrt(variance) * 100) / 100
      } else {
        // Top 3 most frequent values for categorical
        const freq: Record<string, number> = {}
        for (const v of validValues) freq[v] = (freq[v] || 0) + 1
        const topValues = Object.entries(freq)
          .sort(([, a]: [string, number], [, b]: [string, number]) => b - a)
          .slice(0, 3)
          .map(([value, count]) => ({ value, count }))
        profile.topValues = topValues
      }

      return profile
    })

    // 5-row preview (raw strings)
    const preview = rows.slice(0, 5)

    res.json({
      filename: session.filename,
      rowCount,
      columnCount: columnNames.length,
      columns: columnProfiles,
      preview,
    })
  } catch (error) {
    res.status(500).json({ error: "Failed to generate EDA report" })
  }
}

