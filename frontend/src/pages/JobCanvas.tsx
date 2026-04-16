import { useState, useEffect } from "react"
import {
  DndContext,
  DragOverlay,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { fetchJobs, fetchNodes, fetchUploads, createJob, deleteJob, updateJobNode } from "../api"

type UploadSession = {
  id: string
  filename: string
  status: string
}

type Job = {
  id: string
  name: string
  framework: string
  gpus: number
  nodeId: string | null
  status: string
}

type Node = {
  id: string
  name: string
  type: string
  totalGpus: number
  usedGpus: number
  status: string
}

const JOB_COLORS: Record<string, string> = {
  PyTorch: "bg-blue-600",
  TensorFlow: "bg-orange-600",
  JAX: "bg-purple-600",
}

function getColor(framework: string) {
  return JOB_COLORS[framework] || "bg-gray-600"
}

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

export default function JobCanvas() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [nodes, setNodes] = useState<Node[]>([])
  const [datasets, setDatasets] = useState<UploadSession[]>([])
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [activeJob, setActiveJob] = useState<Job | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: "", framework: "PyTorch", gpus: "4", datasetId: "" })

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
            <p className="text-gray-400 text-sm mt-1">Drag training jobs onto GPU nodes to assign them</p>
          </div>
          <div className="flex gap-2">
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
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-gray-400 text-xs mb-1 block">Job Name</label>
              <input
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-blue-500"
                placeholder="e.g. LLaMA Finetune"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Framework</label>
              <select
                className="bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none"
                value={form.framework}
                onChange={e => setForm(p => ({ ...p, framework: e.target.value }))}
              >
                <option>PyTorch</option>
                <option>TensorFlow</option>
                <option>JAX</option>
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
        )}

        {/* Unassigned Jobs */}
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

        {/* Node Grid */}
        <div className="grid grid-cols-2 gap-4">
          {nodes.map(node => (
            <NodeSlot key={node.id} node={node} assignedJobs={getJobsForNode(node.id)} />
          ))}
        </div>
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