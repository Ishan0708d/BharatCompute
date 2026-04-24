import { useState, useEffect } from "react"
import {
  DndContext,
  DragOverlay,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import {
  fetchJobs,
  fetchNodes,
  fetchUploads,
  createJob,
  deleteJob,
  updateJobNode,
  updateJobStage,
  predictDuration,
} from "../api"

// ─────────────────────────────────────────────────────────────────────────────
// JobCanvas.tsx — ML/Big Data Job Scheduler
//
// DSBDA features in this file:
//   • Spark & Hadoop framework support (Big Data tooling)
//   • ML Pipeline Stage Tracker (ETL pipeline visualization)
//   • Job Duration Prediction (predictive analytics via OLS regression)
// ─────────────────────────────────────────────────────────────────────────────

type UploadSession = {
  id: string
  filename: string
  sizeBytes: number
  status: string
}

type Job = {
  id: string
  name: string
  framework: string
  gpus: number
  nodeId: string | null
  status: string
  stage: string
}

type Node = {
  id: string
  name: string
  type: string
  totalGpus: number
  usedGpus: number
  status: string
}

// ── Framework Config ──────────────────────────────────────────────────────────
// Added Spark and Hadoop to align with Big Data Analytics curriculum.
// Spark = in-memory distributed compute; Hadoop = MapReduce batch processing.
const JOB_COLORS: Record<string, string> = {
  PyTorch: "bg-blue-600",
  TensorFlow: "bg-orange-600",
  JAX: "bg-purple-600",
  Spark: "bg-red-600",       // Apache Spark — real-time big data processing
  Hadoop: "bg-green-700",    // Apache Hadoop — batch MapReduce processing
}

function getColor(framework: string) {
  return JOB_COLORS[framework] || "bg-gray-600"
}

// ── Pipeline Stages ───────────────────────────────────────────────────────────
// Represents the stages of a Data Science / Big Data pipeline (DSBDA ETL concept).
// Each stage maps to a data processing step in a typical ML workflow.
const PIPELINE_STAGES = [
  { id: "queued",        label: "Queued",        icon: "⏳", desc: "Waiting to be scheduled" },
  { id: "ingesting",    label: "Ingesting",     icon: "📥", desc: "Data ingestion phase (ETL: Extract)" },
  { id: "preprocessing",label: "Preprocessing", icon: "🔧", desc: "Cleaning & normalization (ETL: Transform)" },
  { id: "training",     label: "Training",      icon: "🧠", desc: "Model training on processed data" },
  { id: "evaluating",   label: "Evaluating",    icon: "📊", desc: "Performance metrics & validation" },
  { id: "done",         label: "Done",          icon: "✅", desc: "Pipeline complete" },
]

const STAGE_COLORS: Record<string, string> = {
  queued: "bg-gray-700 text-gray-300",
  ingesting: "bg-blue-900 text-blue-300",
  preprocessing: "bg-yellow-900 text-yellow-300",
  training: "bg-purple-900 text-purple-300",
  evaluating: "bg-cyan-900 text-cyan-300",
  done: "bg-green-900 text-green-300",
}

// ── Sub-components ────────────────────────────────────────────────────────────

function JobCard({ job }: { job: Job }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: job.id })
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : {}

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`${getColor(job.framework)} rounded-lg p-3 cursor-grab active:cursor-grabbing select-none shadow-lg`}
    >
      <p className="font-semibold text-white text-sm">{job.name}</p>
      <p className="text-white/70 text-xs mt-1">{job.framework} · {job.gpus} GPUs</p>
      <span className={`inline-block mt-1.5 text-xs px-1.5 py-0.5 rounded ${STAGE_COLORS[job.stage] || "bg-gray-700 text-gray-300"}`}>
        {PIPELINE_STAGES.find(s => s.id === job.stage)?.icon} {job.stage}
      </span>
    </div>
  )
}

function NodeSlot({ node, assignedJobs }: { node: Node; assignedJobs: Job[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: node.id })
  const usedGpus = assignedJobs.reduce((a, j) => a + j.gpus, 0)
  const usagePercent = Math.round((usedGpus / node.totalGpus) * 100)

  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border-2 p-4 transition-colors min-h-40 ${
        isOver ? "border-blue-400 bg-blue-950/40" : "border-gray-700 bg-gray-900"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-semibold text-white">{node.name}</p>
          <p className="text-gray-400 text-xs">{node.type} · {node.totalGpus} GPUs</p>
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
          usagePercent > 80 ? "bg-red-900 text-red-400" :
          usagePercent > 40 ? "bg-yellow-900 text-yellow-400" :
          "bg-green-900 text-green-400"
        }`}>
          {usedGpus}/{node.totalGpus} GPUs
        </span>
      </div>

      <div className="w-full bg-gray-800 rounded-full h-1.5 mb-3">
        <div
          className={`h-1.5 rounded-full transition-all ${
            usagePercent > 80 ? "bg-red-500" : usagePercent > 40 ? "bg-yellow-500" : "bg-green-500"
          }`}
          style={{ width: `${usagePercent}%` }}
        />
      </div>

      <div className="space-y-2">
        {assignedJobs.length === 0 && (
          <p className="text-gray-600 text-xs text-center py-4">Drop a job here</p>
        )}
        {assignedJobs.map(job => (
          <div key={job.id} className={`${getColor(job.framework)} rounded-lg p-2`}>
            <p className="text-white text-xs font-semibold">{job.name}</p>
            <p className="text-white/70 text-xs">{job.framework} · {job.gpus} GPUs</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Pipeline Stage Stepper (shown per-job in the unassigned panel) ───────────
function PipelineStepper({ job, onStageChange }: { job: Job; onStageChange: (id: string, stage: string) => void }) {
  const currentIndex = PIPELINE_STAGES.findIndex(s => s.id === job.stage)

  function advance() {
    if (currentIndex < PIPELINE_STAGES.length - 1) {
      const nextStage = PIPELINE_STAGES[currentIndex + 1].id
      onStageChange(job.id, nextStage)
    }
  }

  function regress() {
    if (currentIndex > 0) {
      const prevStage = PIPELINE_STAGES[currentIndex - 1].id
      onStageChange(job.id, prevStage)
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-white text-sm">{job.name}</p>
          <p className="text-gray-400 text-xs">{job.framework} · {job.gpus} GPUs</p>
        </div>
        <div className="flex gap-1">
          <button
            onClick={regress}
            disabled={currentIndex === 0}
            className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-300 disabled:opacity-30 transition-colors"
          >
            ← Back
          </button>
          <button
            onClick={advance}
            disabled={currentIndex === PIPELINE_STAGES.length - 1}
            className="px-2 py-1 text-xs rounded bg-blue-700 hover:bg-blue-600 text-white disabled:opacity-30 transition-colors"
          >
            Next →
          </button>
        </div>
      </div>

      {/* Step dots */}
      <div className="flex items-center gap-1">
        {PIPELINE_STAGES.map((stage, i) => (
          <div key={stage.id} className="flex items-center gap-1 flex-1">
            <div
              className={`flex-none w-6 h-6 rounded-full flex items-center justify-center text-xs transition-all ${
                i < currentIndex
                  ? "bg-green-600 text-white"
                  : i === currentIndex
                  ? "bg-blue-500 text-white ring-2 ring-blue-400 ring-offset-1 ring-offset-gray-900"
                  : "bg-gray-800 text-gray-600"
              }`}
              title={stage.desc}
            >
              {i < currentIndex ? "✓" : stage.icon}
            </div>
            {i < PIPELINE_STAGES.length - 1 && (
              <div className={`h-0.5 flex-1 rounded ${i < currentIndex ? "bg-green-600" : "bg-gray-700"}`} />
            )}
          </div>
        ))}
      </div>
      <p className="text-gray-500 text-xs">
        {PIPELINE_STAGES[currentIndex]?.desc}
      </p>
    </div>
  )
}

// ── Duration Prediction Widget ────────────────────────────────────────────────
function DurationPrediction({ gpus, datasetId, datasets }: {
  gpus: number
  datasetId: string
  datasets: UploadSession[]
}) {
  const [prediction, setPrediction] = useState<{
    estimatedSeconds: number
    confidence: string
    modelUsed: string
    trainingPoints: number
    r2?: number
  } | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!gpus) return
    setLoading(true)
    const ds = datasets.find(d => d.id === datasetId)
    const sizeMB = ds ? ds.sizeBytes / 1e6 : 0
    predictDuration(gpus, sizeMB)
      .then(setPrediction)
      .finally(() => setLoading(false))
  }, [gpus, datasetId, datasets])

  if (loading) return <p className="text-gray-500 text-xs animate-pulse">Computing prediction…</p>
  if (!prediction) return null

  const mins = Math.floor(prediction.estimatedSeconds / 60)
  const secs = prediction.estimatedSeconds % 60
  const durationLabel = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`

  const confidenceColor =
    prediction.confidence === "high" ? "text-green-400" :
    prediction.confidence === "medium" ? "text-yellow-400" : "text-gray-400"

  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 mt-2">
      <p className="text-gray-400 text-xs mb-1 font-medium">🤖 ML Duration Prediction (OLS Regression)</p>
      <p className="text-white font-bold text-lg">~{durationLabel}</p>
      <div className="flex items-center gap-3 mt-1">
        <span className={`text-xs font-medium ${confidenceColor}`}>
          Confidence: {prediction.confidence}
        </span>
        {prediction.r2 !== undefined && (
          <span className="text-gray-500 text-xs">R² = {prediction.r2}</span>
        )}
        <span className="text-gray-500 text-xs">
          {prediction.trainingPoints} training samples
        </span>
      </div>
      <p className="text-gray-600 text-xs mt-1">Model: {prediction.modelUsed}</p>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function JobCanvas() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [nodes, setNodes] = useState<Node[]>([])
  const [datasets, setDatasets] = useState<UploadSession[]>([])
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [activeJob, setActiveJob] = useState<Job | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: "", framework: "PyTorch", gpus: "4", datasetId: "" })
  const [showPipeline, setShowPipeline] = useState(false)

  useEffect(() => {
    fetchJobs().then(data => {
      setJobs(data)
      const initialAssignments: Record<string, string> = {}
      data.forEach((job: Job) => {
        if (job.nodeId) initialAssignments[job.id] = job.nodeId
      })
      setAssignments(initialAssignments)
    })
    fetchNodes().then(setNodes)
    fetchUploads().then((data: UploadSession[]) => setDatasets(data.filter(d => d.status === "completed")))
  }, [])

  function handleDragStart(event: DragStartEvent) {
    const job = jobs.find(j => j.id === event.active.id)
    if (job) setActiveJob(job)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveJob(null)
    if (!over) return
    const jobId = active.id as string
    const targetNodeId = over.id as string

    const job = jobs.find(j => j.id === jobId)
    const node = nodes.find(n => n.id === targetNodeId)

    if (job && node) {
      const currentlyAssignedJobs = jobs.filter(j => assignments[j.id] === targetNodeId && j.id !== jobId)
      const usedGpusBefore = currentlyAssignedJobs.reduce((a, j) => a + j.gpus, 0)
      const usedGpusAfter = usedGpusBefore + job.gpus
      const usagePercentAfter = Math.round((usedGpusAfter / node.totalGpus) * 100)

      if (usagePercentAfter > 80) {
        alert(`Warning: Adding this job will cause ${node.name} to run too hot! (${usagePercentAfter}% utilization)`)
      }
    }

    setAssignments(prev => ({ ...prev, [jobId]: targetNodeId }))
    await updateJobNode(jobId, targetNodeId)
  }

  async function handleCreateJob() {
    if (!form.name) return
    const newJob = await createJob({
      name: form.name,
      framework: form.framework,
      gpus: parseInt(form.gpus),
      datasetId: form.datasetId || undefined,
    })
    setJobs(prev => [...prev, newJob])
    setForm({ name: "", framework: "PyTorch", gpus: "4", datasetId: "" })
    setShowForm(false)
  }

  async function handleDeleteJob(id: string) {
    await deleteJob(id)
    setJobs(prev => prev.filter(j => j.id !== id))
    setAssignments(prev => {
      const copy = { ...prev }
      delete copy[id]
      return copy
    })
  }

  async function handleStageChange(jobId: string, newStage: string) {
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, stage: newStage } : j))
    await updateJobStage(jobId, newStage)
  }

  const unassignedJobs = jobs.filter(j => !assignments[j.id])

  function getJobsForNode(nodeId: string) {
    return jobs.filter(j => assignments[j.id] === nodeId)
  }

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Job Canvas</h2>
            <p className="text-gray-400 text-sm mt-1">Drag ML/Big Data jobs onto GPU nodes to assign them</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowPipeline(v => !v)}
              className={`px-4 py-2 rounded-lg text-sm transition-colors border ${
                showPipeline
                  ? "bg-purple-700 border-purple-500 text-white"
                  : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
              }`}
            >
              🔄 Pipeline View
            </button>
            <button
              onClick={() => setShowForm(v => !v)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm transition-colors"
            >
              + New Job
            </button>
            <button
              onClick={async () => {
                setAssignments({})
                await Promise.all(jobs.filter(j => assignments[j.id]).map(j => updateJobNode(j.id, null)))
              }}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
            >
              Reset All
            </button>
          </div>
        </div>

        {/* New Job Form */}
        {showForm && (
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-4">
            <div className="flex gap-4 items-end flex-wrap">
              <div className="flex-1 min-w-40">
                <label className="text-gray-400 text-xs mb-1 block">Job Name</label>
                <input
                  className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-blue-500"
                  placeholder="e.g. LLaMA Finetune"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div>
                {/* Added Spark and Hadoop to framework list (Big Data Tools — DSBDA Unit) */}
                <label className="text-gray-400 text-xs mb-1 block">Framework</label>
                <select
                  className="bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none"
                  value={form.framework}
                  onChange={e => setForm(p => ({ ...p, framework: e.target.value }))}
                >
                  <optgroup label="ML Frameworks">
                    <option>PyTorch</option>
                    <option>TensorFlow</option>
                    <option>JAX</option>
                  </optgroup>
                  <optgroup label="Big Data Frameworks">
                    <option>Spark</option>
                    <option>Hadoop</option>
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">GPUs</label>
                <input
                  type="number"
                  className="w-20 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none"
                  value={form.gpus}
                  onChange={e => setForm(p => ({ ...p, gpus: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Target Dataset</label>
                <select
                  className="w-48 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none"
                  value={form.datasetId}
                  onChange={e => setForm(p => ({ ...p, datasetId: e.target.value }))}
                >
                  <option value="">None (Standalone)</option>
                  {datasets.map(d => (
                    <option key={d.id} value={d.id}>{d.filename}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleCreateJob}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm"
              >
                Submit
              </button>
            </div>

            {/* Duration Prediction — shows ML regression estimate inline */}
            <DurationPrediction
              gpus={parseInt(form.gpus) || 4}
              datasetId={form.datasetId}
              datasets={datasets}
            />
          </div>
        )}

        {/* Pipeline Stage View — shows all jobs with their ETL pipeline stepper */}
        {showPipeline && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">🔄 ML Pipeline Tracker</h3>
              <span className="text-xs text-gray-500">— advance each job through its ETL stages (DSBDA: Data Pipelines)</span>
            </div>
            {jobs.length === 0 && (
              <p className="text-gray-600 text-sm">No jobs to track. Create a job first.</p>
            )}
            {jobs.map(job => (
              <PipelineStepper key={job.id} job={job} onStageChange={handleStageChange} />
            ))}
          </div>
        )}

        {/* Unassigned Jobs (drag pool) */}
        {!showPipeline && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <p className="text-gray-400 text-sm font-medium mb-3">
              Unassigned Jobs ({unassignedJobs.length})
            </p>
            <div className="flex flex-wrap gap-3">
              {unassignedJobs.length === 0 && (
                <p className="text-gray-600 text-sm">All jobs have been assigned 🎉</p>
              )}
              {unassignedJobs.map(job => (
                <div key={job.id} className="relative group">
                  <JobCard job={job} />
                  <button
                    onClick={() => handleDeleteJob(job.id)}
                    className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-4 h-4 text-xs items-center justify-center hidden group-hover:flex"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Node Grid */}
        {!showPipeline && (
          <div className="grid grid-cols-2 gap-4">
            {nodes.map(node => (
              <NodeSlot key={node.id} node={node} assignedJobs={getJobsForNode(node.id)} />
            ))}
          </div>
        )}
      </div>

      <DragOverlay>
        {activeJob && (
          <div className={`${getColor(activeJob.framework)} rounded-lg p-3 shadow-2xl opacity-90`}>
            <p className="font-semibold text-white text-sm">{activeJob.name}</p>
            <p className="text-white/70 text-xs mt-1">{activeJob.framework} · {activeJob.gpus} GPUs</p>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}