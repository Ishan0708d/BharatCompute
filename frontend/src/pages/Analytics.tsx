import { useEffect, useState } from "react"
import ReactECharts from "echarts-for-react"
import { fetchAnalyticsSummary } from "../api"

// ─────────────────────────────────────────────────────────────────────────────
// Analytics.tsx — Descriptive Analytics Dashboard
//
// DSBDA concepts demonstrated:
//   • Descriptive statistics (mean, std dev, min/max job duration)
//   • Frequency distribution (framework breakdown, stage distribution)
//   • Data summarization (totals, aggregates)
//   • Histogram (dataset size distribution by bins)
//   • Time-series throughput (jobs submitted per day over past 7 days)
// ─────────────────────────────────────────────────────────────────────────────

type AnalyticsSummary = {
  totalJobs: number
  totalDatasets: number
  totalDataIngested: number
  frameworkCounts: Record<string, number>
  stageCounts: Record<string, number>
  statusCounts: Record<string, number>
  durationStats: {
    avg: number
    max: number
    min: number
    stdDev: number
    sampleSize: number
  }
  avgGpuDemand: number
  sizeBins: Record<string, number>
  throughput: { date: string; count: number }[]
}

const FRAMEWORK_COLORS: Record<string, string> = {
  PyTorch: "#3b82f6",
  TensorFlow: "#f97316",
  JAX: "#a855f7",
  Spark: "#ef4444",
  Hadoop: "#22c55e",
}

const STAGE_COLORS: Record<string, string> = {
  queued: "#6b7280",
  ingesting: "#3b82f6",
  preprocessing: "#f59e0b",
  training: "#8b5cf6",
  evaluating: "#06b6d4",
  done: "#22c55e",
}

function formatBytes(bytes: number) {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`
  return `${(bytes / 1e3).toFixed(1)} KB`
}

function formatDuration(seconds: number) {
  if (seconds === 0) return "—"
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

export default function Analytics() {
  const [data, setData] = useState<AnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAnalyticsSummary()
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-sm animate-pulse">Loading analytics…</div>
      </div>
    )
  }

  if (!data) {
    return <div className="text-red-400 text-sm">Failed to load analytics.</div>
  }

  // ── Chart: Job Throughput (line chart — time series) ──────────────────────
  const throughputOption = {
    backgroundColor: "transparent",
    grid: { top: 20, bottom: 30, left: 45, right: 20 },
    xAxis: {
      type: "category",
      data: data.throughput.map((t) => t.date),
      axisLabel: { color: "#6b7280", fontSize: 11 },
      axisLine: { lineStyle: { color: "#374151" } },
    },
    yAxis: {
      type: "value",
      minInterval: 1,
      axisLabel: { color: "#6b7280", fontSize: 11 },
      splitLine: { lineStyle: { color: "#1f2937" } },
    },
    series: [
      {
        data: data.throughput.map((t) => t.count),
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        lineStyle: { color: "#3b82f6", width: 2.5 },
        areaStyle: {
          color: {
            type: "linear",
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(59,130,246,0.3)" },
              { offset: 1, color: "rgba(59,130,246,0)" },
            ],
          },
        },
        itemStyle: { color: "#3b82f6" },
      },
    ],
    tooltip: { trigger: "axis", backgroundColor: "#111827", borderColor: "#374151", textStyle: { color: "#fff" } },
  }

  // ── Chart: Framework Distribution (donut chart — frequency distribution) ──
  const frameworkData = Object.entries(data.frameworkCounts).map(([name, value]) => ({
    name,
    value,
    itemStyle: { color: FRAMEWORK_COLORS[name] || "#6b7280" },
  }))
  const frameworkOption = {
    backgroundColor: "transparent",
    legend: { orient: "vertical", right: 10, top: "center", textStyle: { color: "#9ca3af", fontSize: 11 } },
    series: [
      {
        type: "pie",
        radius: ["45%", "75%"],
        center: ["40%", "50%"],
        data: frameworkData.length ? frameworkData : [{ name: "No data", value: 1, itemStyle: { color: "#1f2937" } }],
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 12, fontWeight: "bold", color: "#fff" } },
      },
    ],
    tooltip: { backgroundColor: "#111827", borderColor: "#374151", textStyle: { color: "#fff" } },
  }

  // ── Chart: Pipeline Stage Distribution (horizontal bar) ───────────────────
  const stageOrder = ["queued", "ingesting", "preprocessing", "training", "evaluating", "done"]
  const stageData = stageOrder.map((stage) => ({
    stage,
    count: data.stageCounts[stage] || 0,
    color: STAGE_COLORS[stage],
  }))
  const stageOption = {
    backgroundColor: "transparent",
    grid: { top: 10, bottom: 10, left: 100, right: 30 },
    xAxis: { type: "value", minInterval: 1, axisLabel: { color: "#6b7280", fontSize: 11 }, splitLine: { lineStyle: { color: "#1f2937" } } },
    yAxis: {
      type: "category",
      data: stageData.map((s) => s.stage),
      axisLabel: { color: "#9ca3af", fontSize: 11 },
      axisLine: { lineStyle: { color: "#374151" } },
    },
    series: [
      {
        type: "bar",
        data: stageData.map((s) => ({ value: s.count, itemStyle: { color: s.color, borderRadius: [0, 4, 4, 0] } })),
        barMaxWidth: 22,
      },
    ],
    tooltip: { backgroundColor: "#111827", borderColor: "#374151", textStyle: { color: "#fff" } },
  }

  // ── Chart: Dataset Size Histogram (bar chart) ─────────────────────────────
  const sizeLabels = Object.keys(data.sizeBins)
  const sizeCounts = Object.values(data.sizeBins)
  const histogramOption = {
    backgroundColor: "transparent",
    grid: { top: 20, bottom: 30, left: 45, right: 20 },
    xAxis: {
      type: "category",
      data: sizeLabels,
      axisLabel: { color: "#6b7280", fontSize: 11 },
      axisLine: { lineStyle: { color: "#374151" } },
    },
    yAxis: {
      type: "value",
      minInterval: 1,
      axisLabel: { color: "#6b7280", fontSize: 11 },
      splitLine: { lineStyle: { color: "#1f2937" } },
    },
    series: [
      {
        type: "bar",
        data: sizeCounts.map((v, i) => ({
          value: v,
          itemStyle: {
            color: ["#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444"][i],
            borderRadius: [4, 4, 0, 0],
          },
        })),
        barMaxWidth: 50,
      },
    ],
    tooltip: {
      formatter: (params: any) => `${params.name}: ${params.value} dataset(s)`,
      backgroundColor: "#111827", borderColor: "#374151", textStyle: { color: "#fff" },
    },
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white">Analytics Dashboard</h2>
        <p className="text-gray-400 text-sm mt-1">
          Descriptive statistics, frequency distributions &amp; data summaries — DSBDA Unit 3
        </p>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Jobs", value: data.totalJobs, color: "text-blue-400", icon: "🧠" },
          { label: "Datasets Uploaded", value: data.totalDatasets, color: "text-purple-400", icon: "📦" },
          { label: "Data Ingested", value: formatBytes(data.totalDataIngested), color: "text-yellow-400", icon: "📥" },
          { label: "Avg GPU Demand", value: `${data.avgGpuDemand} GPUs`, color: "text-green-400", icon: "⚡" },
        ].map((card) => (
          <div key={card.label} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <p className="text-gray-400 text-xs flex items-center gap-1.5">
              <span>{card.icon}</span>{card.label}
            </p>
            <p className={`text-2xl font-bold mt-1 ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Descriptive Stats: Job Duration */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-1">
          📊 Job Duration — Descriptive Statistics
        </h3>
        <p className="text-gray-500 text-xs mb-4">
          Computed over {data.durationStats.sampleSize} completed job(s) with recorded timestamps
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Mean (μ)", value: formatDuration(data.durationStats.avg), desc: "Average job runtime" },
            { label: "Std Dev (σ)", value: formatDuration(data.durationStats.stdDev), desc: "Spread of durations" },
            { label: "Min", value: formatDuration(data.durationStats.min), desc: "Fastest job" },
            { label: "Max", value: formatDuration(data.durationStats.max), desc: "Longest job" },
          ].map((stat) => (
            <div key={stat.label} className="bg-gray-800 rounded-lg p-3">
              <p className="text-xs text-gray-500">{stat.desc}</p>
              <p className="text-lg font-bold text-white mt-1">{stat.value}</p>
              <p className="text-xs text-gray-500 mt-0.5 font-mono">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Charts Row 1: Throughput + Framework Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-0.5">📈 Job Throughput (Last 7 Days)</h3>
          <p className="text-gray-500 text-xs mb-3">Time-series view of job submission rate — data ingestion activity</p>
          <ReactECharts option={throughputOption} style={{ height: 200 }} />
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-0.5">🥧 Framework Distribution</h3>
          <p className="text-gray-500 text-xs mb-3">Frequency distribution of ML/Big Data frameworks used across all jobs</p>
          <ReactECharts option={frameworkOption} style={{ height: 200 }} />
        </div>
      </div>

      {/* Charts Row 2: Pipeline Stage + Dataset Histogram */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-0.5">🔄 Pipeline Stage Distribution</h3>
          <p className="text-gray-500 text-xs mb-3">How jobs are distributed across ETL pipeline stages</p>
          <ReactECharts option={stageOption} style={{ height: 220 }} />
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-0.5">📦 Dataset Size Histogram</h3>
          <p className="text-gray-500 text-xs mb-3">Frequency distribution of uploaded dataset sizes (binned)</p>
          <ReactECharts option={histogramOption} style={{ height: 220 }} />
        </div>
      </div>

      {/* Raw Data Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">📋 Status Breakdown</h3>
        <div className="flex flex-wrap gap-3">
          {Object.entries(data.statusCounts).length === 0 && (
            <p className="text-gray-600 text-sm">No job status data yet.</p>
          )}
          {Object.entries(data.statusCounts).map(([status, count]) => (
            <div key={status} className="bg-gray-800 rounded-lg px-4 py-2 flex items-center gap-3">
              <span className="text-gray-400 text-xs font-mono capitalize">{status}</span>
              <span className="text-white font-bold">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
