import { useState } from "react"
import {
  DndContext,
  DragOverlay,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"

const INITIAL_JOBS = [
  { id: "job-1", name: "GPT-4 Finetune", framework: "PyTorch", gpus: 8, color: "bg-blue-600" },
  { id: "job-2", name: "ResNet Training", framework: "TensorFlow", gpus: 4, color: "bg-purple-600" },
  { id: "job-3", name: "BERT Pretraining", framework: "JAX", gpus: 16, color: "bg-pink-600" },
  { id: "job-4", name: "Stable Diffusion", framework: "PyTorch", gpus: 8, color: "bg-orange-600" },
]

const NODES = [
  { id: "node-1", name: "Node-001", type: "A100", totalGpus: 16 },
  { id: "node-2", name: "Node-002", type: "A100", totalGpus: 16 },
  { id: "node-3", name: "Node-003", type: "H100", totalGpus: 8 },
  { id: "node-4", name: "Node-004", type: "H100", totalGpus: 8 },
]

type Job = typeof INITIAL_JOBS[0]

function JobCard({ job, isDragging = false }: { job: Job; isDragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: job.id })
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : {}

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`${job.color} ${isDragging ? "opacity-50" : ""} rounded-lg p-3 cursor-grab active:cursor-grabbing select-none shadow-lg`}
    >
      <p className="font-semibold text-white text-sm">{job.name}</p>
      <p className="text-white/70 text-xs mt-1">{job.framework} · {job.gpus} GPUs</p>
    </div>
  )
}

function NodeSlot({ node, assignedJobs }: { node: typeof NODES[0]; assignedJobs: Job[] }) {
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

      {/* Usage Bar */}
      <div className="w-full bg-gray-800 rounded-full h-1.5 mb-3">
        <div
          className={`h-1.5 rounded-full transition-all ${
            usagePercent > 80 ? "bg-red-500" : usagePercent > 40 ? "bg-yellow-500" : "bg-green-500"
          }`}
          style={{ width: `${usagePercent}%` }}
        />
      </div>

      {/* Assigned Jobs */}
      <div className="space-y-2">
        {assignedJobs.length === 0 && (
          <p className="text-gray-600 text-xs text-center py-4">Drop a job here</p>
        )}
        {assignedJobs.map(job => (
          <div key={job.id} className={`${job.color} rounded-lg p-2`}>
            <p className="text-white text-xs font-semibold">{job.name}</p>
            <p className="text-white/70 text-xs">{job.framework} · {job.gpus} GPUs</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function JobCanvas() {
  const [jobs, setJobs] = useState(INITIAL_JOBS)
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [activeJob, setActiveJob] = useState<Job | null>(null)

  function handleDragStart(event: DragStartEvent) {
    const job = jobs.find(j => j.id === event.active.id)
    if (job) setActiveJob(job)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveJob(null)
    if (!over) return

    setAssignments(prev => ({ ...prev, [active.id as string]: over.id as string }))
  }

  const unassignedJobs = jobs.filter(j => !assignments[j.id])

  function getJobsForNode(nodeId: string) {
    return jobs.filter(j => assignments[j.id] === nodeId)
  }

  function handleReset() {
    setAssignments({})
  }

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Job Canvas</h2>
            <p className="text-gray-400 text-sm mt-1">Drag training jobs onto GPU nodes to assign them</p>
          </div>
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
          >
            Reset All
          </button>
        </div>

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
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        </div>

        {/* Node Grid */}
        <div className="grid grid-cols-2 gap-4">
          {NODES.map(node => (
            <NodeSlot key={node.id} node={node} assignedJobs={getJobsForNode(node.id)} />
          ))}
        </div>
      </div>

      <DragOverlay>
        {activeJob && (
          <div className={`${activeJob.color} rounded-lg p-3 shadow-2xl opacity-90`}>
            <p className="font-semibold text-white text-sm">{activeJob.name}</p>
            <p className="text-white/70 text-xs mt-1">{activeJob.framework} · {activeJob.gpus} GPUs</p>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}