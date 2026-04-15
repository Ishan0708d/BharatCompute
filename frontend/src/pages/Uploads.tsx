import { useState, useRef } from "react"

type UploadFile = {
  id: string
  name: string
  size: number
  progress: number
  status: "uploading" | "done" | "error"
}

function formatSize(bytes: number) {
  if (bytes > 1e9) return `${(bytes / 1e9).toFixed(1)} GB`
  if (bytes > 1e6) return `${(bytes / 1e6).toFixed(1)} MB`
  return `${(bytes / 1e3).toFixed(1)} KB`
}

export default function Uploads() {
  const [files, setFiles] = useState<UploadFile[]>([])
  const [draggingOver, setDraggingOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function simulateUpload(file: File) {
    const newFile: UploadFile = {
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      progress: 0,
      status: "uploading",
    }

    setFiles(prev => [...prev, newFile])

    let progress = 0
    const interval = setInterval(() => {
      progress += randomBetween(5, 15)
      if (progress >= 100) {
        progress = 100
        clearInterval(interval)
        setFiles(prev =>
          prev.map(f => f.id === newFile.id ? { ...f, progress: 100, status: "done" } : f)
        )
      } else {
        setFiles(prev =>
          prev.map(f => f.id === newFile.id ? { ...f, progress } : f)
        )
      }
    }, 300)
  }

  function randomBetween(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  function handleFiles(incoming: FileList | null) {
    if (!incoming) return
    Array.from(incoming).forEach(simulateUpload)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDraggingOver(false)
    handleFiles(e.dataTransfer.files)
  }

  const totalDone = files.filter(f => f.status === "done").length
  const totalSize = files.reduce((a, f) => a + f.size, 0)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Dataset Uploads</h2>
        <p className="text-gray-400 text-sm mt-1">Upload training datasets to the cluster storage</p>
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
        <p className="text-gray-600 text-xs mt-3">Supports any file type · Multi-file upload</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-800 text-gray-400">
              <tr>
                {["Filename", "Size", "Progress", "Status"].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {files.map(file => (
                <tr key={file.id} className="border-t border-gray-800">
                  <td className="px-4 py-3 text-white font-mono text-xs">{file.name}</td>
                  <td className="px-4 py-3 text-gray-400">{formatSize(file.size)}</td>
                  <td className="px-4 py-3 w-48">
                    <div className="w-full bg-gray-800 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          file.status === "done" ? "bg-green-500" :
                          file.status === "error" ? "bg-red-500" : "bg-blue-500"
                        }`}
                        style={{ width: `${file.progress}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      file.status === "done" ? "bg-green-900 text-green-400" :
                      file.status === "error" ? "bg-red-900 text-red-400" :
                      "bg-blue-900 text-blue-400"
                    }`}>
                      {file.status === "done" ? "Complete" :
                       file.status === "error" ? "Failed" : `${file.progress}%`}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}