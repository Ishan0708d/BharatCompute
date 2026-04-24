import { useState, useRef } from "react"
import { initiateUpload, uploadFileData, fetchDatasetEda } from "../api"

// ─────────────────────────────────────────────────────────────────────────────
// Uploads.tsx — Data Ingestion Pipeline with EDA Reports
//
// DSBDA features added:
//   • "Run EDA" button per uploaded CSV: triggers backend CSV profiling
//   • Per-column data profile: dtype, null rate, min/max/mean/stdDev (numeric)
//     or top frequent values (categorical) — core EDA techniques
//   • Data quality indicator: columns with >20% nulls flagged in amber/red
//   • 5-row data preview table (visual inspection of raw data — EDA step 1)
// ─────────────────────────────────────────────────────────────────────────────

type UploadFile = {
  id: string
  name: string
  size: number
  progress: number
  status: "uploading" | "done" | "error"
}

type ColumnProfile = {
  name: string
  dtype: "numeric" | "categorical"
  nullCount: number
  nullRate: number
  uniqueCount: number
  // numeric-only
  min?: number
  max?: number
  mean?: number
  stdDev?: number
  // categorical-only
  topValues?: { value: string; count: number }[]
}

type EdaReport = {
  filename: string
  rowCount: number
  columnCount: number
  columns: ColumnProfile[]
  preview: Record<string, string>[]
  error?: string
}

function formatSize(bytes: number) {
  if (bytes > 1e9) return `${(bytes / 1e9).toFixed(1)} GB`
  if (bytes > 1e6) return `${(bytes / 1e6).toFixed(1)} MB`
  return `${(bytes / 1e3).toFixed(1)} KB`
}

// Colour-codes a null rate: green < 5%, amber 5-20%, red > 20%
function nullRateColor(rate: number) {
  if (rate === 0) return "text-green-400"
  if (rate <= 20) return "text-yellow-400"
  return "text-red-400"
}

function EdaPanel({ report }: { report: EdaReport }) {
  if (report.error) {
    return (
      <div className="mt-3 bg-red-950/40 border border-red-800 rounded-lg p-3">
        <p className="text-red-400 text-xs">{report.error}</p>
        <p className="text-gray-500 text-xs mt-1">Only completed CSV uploads can be profiled.</p>
      </div>
    )
  }

  const colNames = report.columns.map(c => c.name)

  return (
    <div className="mt-3 space-y-4">
      {/* Summary row */}
      <div className="flex gap-4 flex-wrap">
        {[
          { label: "Rows", value: report.rowCount.toLocaleString() },
          { label: "Columns", value: report.columnCount },
          {
            label: "Numeric cols",
            value: report.columns.filter(c => c.dtype === "numeric").length,
          },
          {
            label: "Categorical cols",
            value: report.columns.filter(c => c.dtype === "categorical").length,
          },
          {
            label: "Cols with nulls",
            value: report.columns.filter(c => c.nullCount > 0).length,
          },
        ].map(s => (
          <div key={s.label} className="bg-gray-800 rounded-lg px-3 py-1.5">
            <p className="text-gray-500 text-xs">{s.label}</p>
            <p className="text-white font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Column profiles table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-800 text-gray-400">
            <tr>
              {["Column", "Type", "Nulls", "Null %", "Unique", "Stats"].map(h => (
                <th key={h} className="text-left px-3 py-2 font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.columns.map(col => (
              <tr key={col.name} className="border-t border-gray-800 hover:bg-gray-800/40">
                <td className="px-3 py-2 font-mono text-blue-300 whitespace-nowrap">{col.name}</td>
                <td className="px-3 py-2">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                    col.dtype === "numeric" ? "bg-blue-900 text-blue-300" : "bg-purple-900 text-purple-300"
                  }`}>
                    {col.dtype}
                  </span>
                </td>
                <td className="px-3 py-2 text-gray-300">{col.nullCount}</td>
                <td className={`px-3 py-2 font-semibold ${nullRateColor(col.nullRate)}`}>
                  {col.nullRate}%
                </td>
                <td className="px-3 py-2 text-gray-300">{col.uniqueCount}</td>
                <td className="px-3 py-2 text-gray-400">
                  {col.dtype === "numeric" ? (
                    <span>
                      μ={col.mean} σ={col.stdDev} [{col.min}, {col.max}]
                    </span>
                  ) : (
                    <span className="font-mono">
                      {col.topValues?.map(v => `"${v.value}"(${v.count})`).join(", ")}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 5-row data preview */}
      {report.preview.length > 0 && (
        <div>
          <p className="text-gray-500 text-xs mb-2 font-medium">📋 Data Preview (first 5 rows)</p>
          <div className="overflow-x-auto">
            <table className="text-xs w-full">
              <thead className="bg-gray-800 text-gray-400">
                <tr>
                  {colNames.map(col => (
                    <th key={col} className="px-2 py-1.5 text-left font-medium whitespace-nowrap">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.preview.map((row, i) => (
                  <tr key={i} className="border-t border-gray-800">
                    {colNames.map(col => (
                      <td key={col} className="px-2 py-1.5 text-gray-300 font-mono whitespace-nowrap max-w-32 truncate" title={row[col]}>
                        {row[col] || <span className="text-red-500 italic">null</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Uploads() {
  const [files, setFiles] = useState<UploadFile[]>([])
  const [draggingOver, setDraggingOver] = useState(false)
  const [edaReports, setEdaReports] = useState<Record<string, EdaReport | "loading">>({})
  const [expandedEda, setExpandedEda] = useState<Record<string, boolean>>({})
  const inputRef = useRef<HTMLInputElement>(null)

  async function startUpload(file: File) {
    try {
      const session = await initiateUpload(file.name, file.size)

      const newFile: UploadFile = {
        id: session.id,
        name: file.name,
        size: file.size,
        progress: 0,
        status: "uploading",
      }

      setFiles(prev => [...prev, newFile])

      await uploadFileData(session.id, file, (progress) => {
        setFiles(prev =>
          prev.map(f => f.id === session.id ? { ...f, progress } : f)
        )
      })

      setFiles(prev =>
        prev.map(f => f.id === session.id ? { ...f, progress: 100, status: "done" } : f)
      )
    } catch {
      setFiles(prev =>
        prev.map(f => f.name === file.name && f.status === "uploading" ? { ...f, status: "error" } : f)
      )
    }
  }

  function handleFiles(incoming: FileList | null) {
    if (!incoming) return
    Array.from(incoming).forEach(startUpload)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDraggingOver(false)
    handleFiles(e.dataTransfer.files)
  }

  async function runEda(fileId: string) {
    setEdaReports(prev => ({ ...prev, [fileId]: "loading" }))
    setExpandedEda(prev => ({ ...prev, [fileId]: true }))
    try {
      const report = await fetchDatasetEda(fileId)
      setEdaReports(prev => ({ ...prev, [fileId]: report }))
    } catch {
      setEdaReports(prev => ({
        ...prev,
        [fileId]: { error: "Failed to fetch EDA report", filename: "", rowCount: 0, columnCount: 0, columns: [], preview: [] }
      }))
    }
  }

  const totalDone = files.filter(f => f.status === "done").length
  const totalSize = files.reduce((a, f) => a + f.size, 0)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Data Ingestion Pipeline</h2>
        <p className="text-gray-400 text-sm mt-1">
          Upload training datasets · Run EDA profiling on CSV files — DSBDA: Data Preprocessing &amp; EDA
        </p>
      </div>

      {/* Stats */}
      {files.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Files", value: files.length },
            { label: "Completed", value: totalDone },
            { label: "Total Size", value: formatSize(totalSize) },
          ].map(s => (
            <div key={s.label} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <p className="text-gray-400 text-sm">{s.label}</p>
              <p className="text-2xl font-bold text-white mt-1">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Drop Zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDraggingOver(true) }}
        onDragLeave={() => setDraggingOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`rounded-xl border-2 border-dashed p-16 text-center cursor-pointer transition-colors ${
          draggingOver
            ? "border-blue-400 bg-blue-950/30"
            : "border-gray-700 hover:border-gray-500 bg-gray-900"
        }`}
      >
        <p className="text-4xl mb-3">📦</p>
        <p className="text-white font-semibold">Drop dataset files here</p>
        <p className="text-gray-400 text-sm mt-1">or click to browse</p>
        <p className="text-gray-600 text-xs mt-3">CSV files support EDA profiling · Multi-file upload</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
      </div>

      {/* File List with EDA panel */}
      {files.length > 0 && (
        <div className="space-y-3">
          {files.map(file => (
            <div key={file.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              {/* File row */}
              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-xs text-white truncate">{file.name}</p>
                  <p className="text-gray-500 text-xs">{formatSize(file.size)}</p>
                </div>

                {/* Progress bar */}
                <div className="w-32">
                  <div className="w-full bg-gray-800 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        file.status === "done" ? "bg-green-500" :
                        file.status === "error" ? "bg-red-500" : "bg-blue-500"
                      }`}
                      style={{ width: `${file.progress}%` }}
                    />
                  </div>
                </div>

                {/* Status badge */}
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${
                  file.status === "done" ? "bg-green-900 text-green-400" :
                  file.status === "error" ? "bg-red-900 text-red-400" :
                  "bg-blue-900 text-blue-400"
                }`}>
                  {file.status === "done" ? "Complete" :
                   file.status === "error" ? "Failed" : `${file.progress}%`}
                </span>

                {/* EDA button — only for completed CSV uploads */}
                {file.status === "done" && file.name.toLowerCase().endsWith(".csv") && (
                  <button
                    onClick={() => {
                      if (expandedEda[file.id] && edaReports[file.id]) {
                        setExpandedEda(prev => ({ ...prev, [file.id]: false }))
                      } else {
                        runEda(file.id)
                      }
                    }}
                    className="px-3 py-1 text-xs rounded-lg bg-purple-800 hover:bg-purple-700 text-purple-200 border border-purple-600 transition-colors whitespace-nowrap"
                  >
                    {expandedEda[file.id] ? "Hide EDA" : "🔍 Run EDA"}
                  </button>
                )}

                {file.status === "done" && !file.name.toLowerCase().endsWith(".csv") && (
                  <span className="text-xs text-gray-600 italic">Non-CSV</span>
                )}
              </div>

              {/* EDA Report panel */}
              {expandedEda[file.id] && (
                <div className="mt-3 border-t border-gray-700 pt-3">
                  <p className="text-purple-300 text-xs font-semibold mb-2">
                    🔬 EDA Report — Exploratory Data Analysis (DSBDA: Data Preprocessing)
                  </p>
                  {edaReports[file.id] === "loading" ? (
                    <p className="text-gray-500 text-xs animate-pulse">Parsing CSV and profiling columns…</p>
                  ) : edaReports[file.id] ? (
                    <EdaPanel report={edaReports[file.id] as EdaReport} />
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}