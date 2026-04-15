import { useEffect, useState } from "react"
import ReactECharts from "echarts-for-react"

const NODES = ["Node-001", "Node-002", "Node-003", "Node-004", "Node-005", "Node-006"]

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function generateNodeData() {
  return NODES.map(name => ({
    name,
    gpu: randomBetween(40, 99),
    memory: randomBetween(30, 95),
    temp: randomBetween(55, 85),
    power: randomBetween(200, 400),
    status: Math.random() > 0.15 ? "online" : "offline"
  }))
}

export default function Dashboard() {
  const [nodes, setNodes] = useState(generateNodeData())
  const [history, setHistory] = useState<number[]>(Array(20).fill(0).map(() => randomBetween(40, 90)))
  const [time, setTime] = useState<string[]>(Array(20).fill("").map((_, i) => `${i}s`))

  useEffect(() => {
    const interval = setInterval(() => {
      setNodes(generateNodeData())
      setHistory(prev => [...prev.slice(1), randomBetween(40, 90)])
      setTime(prev => [...prev.slice(1), `${Date.now() % 10000}ms`])
    }, 1500)
    return () => clearInterval(interval)
  }, [])

  const avgGpu = Math.floor(nodes.reduce((a, n) => a + n.gpu, 0) / nodes.length)
  const avgTemp = Math.floor(nodes.reduce((a, n) => a + n.temp, 0) / nodes.length)
  const totalPower = nodes.reduce((a, n) => a + n.power, 0)
  const onlineCount = nodes.filter(n => n.status === "online").length

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

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Avg GPU Utilization", value: `${avgGpu}%`, color: "text-blue-400" },
          { label: "Nodes Online", value: `${onlineCount} / ${NODES.length}`, color: "text-green-400" },
          { label: "Avg Temperature", value: `${avgTemp}°C`, color: "text-yellow-400" },
          { label: "Total Power Draw", value: `${totalPower}W`, color: "text-purple-400" },
        ].map(card => (
          <div key={card.label} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <p className="text-gray-400 text-sm">{card.label}</p>
            <p className={`text-3xl font-bold mt-1 ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
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