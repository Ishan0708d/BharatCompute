import { useEffect, useState, useCallback } from "react"
import ReactECharts from "echarts-for-react"
import { io } from "socket.io-client"
import { fetchTelemetryHistory } from "../api"

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard.tsx — Real-time + Historical Cluster Monitoring
//
// DSBDA features:
//   • Real-time streaming telemetry via WebSocket (live data stream)
//   • Historical time-series chart from persisted TelemetrySnapshot rows
//     (Data Warehousing — query the past, not just the present)
//   • Sliding window selector: view last 15m / 1h / 6h of stored data
// ─────────────────────────────────────────────────────────────────────────────

type TelemetryNode = {
  name: string
  status: string
  gpu: number
  memory: number
  temp: number
  power: number
}

type HistoryPoint = {
  timestamp: string
  gpu: number
  memory: number
  temp: number
  power: number
}

type HistorySummary = {
  avgGpu: number
  peakGpu: number
  avgTemp: number
  peakTemp: number
  totalSnapshots: number
  windowMinutes: number
}

const WINDOW_OPTIONS = [
  { label: "15 min", value: 15 },
  { label: "1 hour", value: 60 },
  { label: "6 hours", value: 360 },
]

export default function Dashboard() {
  const [nodes, setNodes] = useState<TelemetryNode[]>([])
  const [history, setHistory] = useState<number[]>(Array(20).fill(0))
  const [time, setTime] = useState<string[]>(Array(20).fill("").map((_, i) => `${i}s`))

  // Historical telemetry state
  const [selectedNode, setSelectedNode] = useState<string>("")
  const [windowMinutes, setWindowMinutes] = useState(60)
  const [histData, setHistData] = useState<HistoryPoint[]>([])
  const [histStats, setHistStats] = useState<HistorySummary | null>(null)
  const [histLoading, setHistLoading] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    const socket = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:4000")

    socket.on("telemetry_update", (enrichedNodes: TelemetryNode[]) => {
      setNodes(enrichedNodes)
      const avgGpu = Math.floor(enrichedNodes.reduce((a, n) => a + n.gpu, 0) / enrichedNodes.length)
      setHistory(prev => [...prev.slice(1), avgGpu])
      setTime(prev => [...prev.slice(1), `${new Date().getSeconds()}s`])
    })

    return () => { socket.disconnect() }
  }, [])

  // Populate default selected node once nodes arrive
  useEffect(() => {
    if (nodes.length > 0 && !selectedNode) {
      setSelectedNode(nodes[0].name)
    }
  }, [nodes, selectedNode])

  const loadHistory = useCallback(async () => {
    if (!selectedNode) return
    setHistLoading(true)
    try {
      const res = await fetchTelemetryHistory(selectedNode, windowMinutes)
      setHistData(res.history || [])
      setHistStats(res.summaryStats || null)
    } finally {
      setHistLoading(false)
    }
  }, [selectedNode, windowMinutes])

  useEffect(() => {
    if (showHistory) loadHistory()
  }, [showHistory, loadHistory])

  const avgGpu = nodes.length ? Math.floor(nodes.reduce((a, n) => a + n.gpu, 0) / nodes.length) : 0
  const avgTemp = nodes.length ? Math.floor(nodes.reduce((a, n) => a + n.temp, 0) / nodes.length) : 0
  const totalPower = nodes.reduce((a, n) => a + n.power, 0)
  const onlineCount = nodes.filter(n => n.status === "online").length
  const totalNodes = nodes.length

  // ── Live GPU Utilization chart ────────────────────────────────────────────
  const lineChartOption = {
    backgroundColor: "transparent",
    grid: { top: 20, bottom: 30, left: 50, right: 20 },
    xAxis: { type: "category", data: time, axisLabel: { color: "#6b7280" } },
    yAxis: { type: "value", min: 0, max: 100, axisLabel: { color: "#6b7280", formatter: "{value}%" } },
    series: [{
      data: history,
      type: "line",
      smooth: true,
      lineStyle: { color: "#3b82f6", width: 2 },
      areaStyle: { color: "rgba(59,130,246,0.15)" },
      symbol: "none"
    }],
    tooltip: { trigger: "axis", formatter: "{b}: {c}%" }
  }

  // ── Per-node bar chart ────────────────────────────────────────────────────
  const barChartOption = {
    backgroundColor: "transparent",
    grid: { top: 20, bottom: 40, left: 50, right: 20 },
    xAxis: { type: "category", data: nodes.map(n => n.name), axisLabel: { color: "#6b7280", rotate: 30 } },
    yAxis: { type: "value", max: 100, axisLabel: { color: "#6b7280", formatter: "{value}%" } },
    series: [{
      data: nodes.map(n => ({
        value: n.gpu,
        itemStyle: { color: n.gpu > 80 ? "#ef4444" : n.gpu > 60 ? "#f59e0b" : "#22c55e" }
      })),
      type: "bar",
      barMaxWidth: 40,
    }],
    tooltip: { trigger: "axis", formatter: "{b}: {c}%" }
  }

  // ── Historical time-series multi-line chart ───────────────────────────────
  // DSBDA: shows stored data from TelemetrySnapshot table — data warehouse query result
  const formatTimestamp = (ts: string) => {
    const d = new Date(ts)
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
  }

  const histChartOption = {
    backgroundColor: "transparent",
    legend: {
      data: ["GPU %", "Memory %", "Temp °C", "Power W"],
      textStyle: { color: "#9ca3af", fontSize: 11 },
      bottom: 0,
    },
    grid: { top: 20, bottom: 50, left: 55, right: 20 },
    xAxis: {
      type: "category",
      data: histData.map(d => formatTimestamp(d.timestamp)),
      axisLabel: { color: "#6b7280", fontSize: 10, rotate: 30 },
      axisLine: { lineStyle: { color: "#374151" } },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#6b7280", fontSize: 10 },
      splitLine: { lineStyle: { color: "#1f2937" } },
    },
    series: [
      { name: "GPU %",    data: histData.map(d => d.gpu),    type: "line", smooth: true, lineStyle: { color: "#3b82f6", width: 1.5 }, symbol: "none" },
      { name: "Memory %", data: histData.map(d => d.memory), type: "line", smooth: true, lineStyle: { color: "#8b5cf6", width: 1.5 }, symbol: "none" },
      { name: "Temp °C",  data: histData.map(d => d.temp),   type: "line", smooth: true, lineStyle: { color: "#f59e0b", width: 1.5 }, symbol: "none" },
      { name: "Power W",  data: histData.map(d => d.power),  type: "line", smooth: true, lineStyle: { color: "#ef4444", width: 1.5 }, symbol: "none" },
    ],
    tooltip: { trigger: "axis", backgroundColor: "#111827", borderColor: "#374151", textStyle: { color: "#fff" } },
  }

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Avg GPU Utilization", value: `${avgGpu}%`, color: "text-blue-400" },
          { label: "Nodes Online", value: `${onlineCount} / ${totalNodes}`, color: "text-green-400" },
          { label: "Avg Temperature", value: `${avgTemp}°C`, color: "text-yellow-400" },
          { label: "Total Power Draw", value: `${totalPower}W`, color: "text-purple-400" },
        ].map(card => (
          <div key={card.label} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <p className="text-gray-400 text-sm">{card.label}</p>
            <p className={`text-3xl font-bold mt-1 ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Live Charts */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <h2 className="text-sm font-semibold text-gray-400 mb-2">Cluster GPU Utilization (Live)</h2>
          <ReactECharts option={lineChartOption} style={{ height: 220 }} />
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <h2 className="text-sm font-semibold text-gray-400 mb-2">Per-Node GPU Usage</h2>
          <ReactECharts option={barChartOption} style={{ height: 220 }} />
        </div>
      </div>

      {/* ── Historical Telemetry Section ─────────────────────────────────── */}
      {/* DSBDA: Time-series data warehousing — query persisted snapshots    */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-white">📼 Historical Telemetry</h2>
            <p className="text-gray-500 text-xs mt-0.5">
              Persisted time-series data from database — DSBDA: Data Warehousing &amp; Sliding Window Analysis
            </p>
          </div>
          <button
            onClick={() => setShowHistory(v => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              showHistory
                ? "bg-blue-700 border-blue-500 text-white"
                : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
            }`}
          >
            {showHistory ? "Hide" : "Show"} History
          </button>
        </div>

        {showHistory && (
          <div className="space-y-4">
            {/* Controls */}
            <div className="flex items-center gap-3 flex-wrap">
              <div>
                <label className="text-gray-500 text-xs block mb-1">Node</label>
                <select
                  className="bg-gray-800 text-white rounded-lg px-3 py-1.5 text-sm border border-gray-700 focus:outline-none"
                  value={selectedNode}
                  onChange={e => setSelectedNode(e.target.value)}
                >
                  {nodes.map(n => (
                    <option key={n.name} value={n.name}>{n.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-gray-500 text-xs block mb-1">Time Window</label>
                <div className="flex gap-1">
                  {WINDOW_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setWindowMinutes(opt.value)}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                        windowMinutes === opt.value
                          ? "bg-blue-600 border-blue-500 text-white"
                          : "bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-4">
                <button
                  onClick={loadHistory}
                  disabled={histLoading}
                  className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg border border-gray-600 transition-colors disabled:opacity-50"
                >
                  {histLoading ? "Loading…" : "↻ Refresh"}
                </button>
              </div>
            </div>

            {/* Summary Stats from historical window */}
            {histStats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Avg GPU", value: `${histStats.avgGpu}%`, color: "text-blue-400" },
                  { label: "Peak GPU", value: `${histStats.peakGpu}%`, color: "text-red-400" },
                  { label: "Avg Temp", value: `${histStats.avgTemp}°C`, color: "text-yellow-400" },
                  { label: "Peak Temp", value: `${histStats.peakTemp}°C`, color: "text-orange-400" },
                ].map(s => (
                  <div key={s.label} className="bg-gray-800 rounded-lg px-3 py-2">
                    <p className="text-gray-500 text-xs">{s.label} (last {histStats.windowMinutes}m)</p>
                    <p className={`font-bold text-lg ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Multi-line historical chart */}
            {histData.length === 0 && !histLoading && (
              <p className="text-gray-600 text-sm text-center py-6">
                No historical data yet. The system collects one snapshot every 1.5 seconds — check back soon.
              </p>
            )}
            {histData.length > 0 && (
              <ReactECharts option={histChartOption} style={{ height: 260 }} />
            )}
          </div>
        )}
      </div>

      {/* Node Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-800 text-gray-400">
            <tr>
              {["Node", "Status", "GPU %", "Memory %", "Temp", "Power"].map(h => (
                <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {nodes.map(node => (
              <tr key={node.name} className="border-t border-gray-800 hover:bg-gray-800/50 transition-colors">
                <td className="px-4 py-3 font-mono text-blue-300">{node.name}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${node.status === "online" ? "bg-green-900 text-green-400" : "bg-red-900 text-red-400"}`}>
                    {node.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-white">{node.gpu}%</td>
                <td className="px-4 py-3 text-white">{node.memory}%</td>
                <td className="px-4 py-3 text-white">{node.temp}°C</td>
                <td className="px-4 py-3 text-white">{node.power}W</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}