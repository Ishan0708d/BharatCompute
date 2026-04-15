export type JobStatus = "pending" | "running" | "completed" | "failed"

export type Job = {
  id: string
  name: string
  framework: string
  gpus: number
  nodeId: string | null
  status: JobStatus
  submittedAt: string
  startedAt: string | null
  completedAt: string | null
}

export type Node = {
  id: string
  name: string
  type: string
  totalGpus: number
  usedGpus: number
  temperature: number
  power: number
  status: "online" | "offline"
}

export type UploadSession = {
  id: string
  filename: string
  sizeBytes: number
  progress: number
  status: "in_progress" | "completed" | "failed"
  createdAt: string
}

// In-memory stores — replace these with DB calls later
export const jobs: Job[] = [
  { id: "job-1", name: "GPT-4 Finetune", framework: "PyTorch", gpus: 8, nodeId: "node-1", status: "running", submittedAt: new Date().toISOString(), startedAt: new Date().toISOString(), completedAt: null },
  { id: "job-2", name: "ResNet Training", framework: "TensorFlow", gpus: 4, nodeId: null, status: "pending", submittedAt: new Date().toISOString(), startedAt: null, completedAt: null },
  { id: "job-3", name: "BERT Pretraining", framework: "JAX", gpus: 16, nodeId: "node-2", status: "completed", submittedAt: new Date().toISOString(), startedAt: new Date().toISOString(), completedAt: new Date().toISOString() },
]

export const nodes: Node[] = [
  { id: "node-1", name: "Node-001", type: "A100", totalGpus: 16, usedGpus: 8, temperature: 72, power: 320, status: "online" },
  { id: "node-2", name: "Node-002", type: "A100", totalGpus: 16, usedGpus: 16, temperature: 81, power: 400, status: "online" },
  { id: "node-3", name: "Node-003", type: "H100", totalGpus: 8, usedGpus: 0, temperature: 58, power: 210, status: "online" },
  { id: "node-4", name: "Node-004", type: "H100", totalGpus: 8, usedGpus: 0, temperature: 0, power: 0, status: "offline" },
]

export const uploadSessions: UploadSession[] = []