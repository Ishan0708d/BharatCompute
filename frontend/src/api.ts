import axios from "axios"

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api"

export async function fetchNodes() {
  const res = await fetch(`${BASE_URL}/nodes`)
  return res.json()
}

export async function fetchJobs() {
  const res = await fetch(`${BASE_URL}/jobs`)
  return res.json()
}

export async function fetchUploads() {
  const res = await fetch(`${BASE_URL}/uploads`)
  return res.json()
}

export async function createJob(data: { name: string; framework: string; gpus: number; nodeId?: string; datasetId?: string }) {
  const res = await fetch(`${BASE_URL}/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  return res.json()
}

export async function deleteJob(id: string) {
  const res = await fetch(`${BASE_URL}/jobs/${id}`, { method: "DELETE" })
  return res.json()
}

export async function initiateUpload(filename: string, sizeBytes: number) {
  const res = await fetch(`${BASE_URL}/uploads/initiate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, sizeBytes }),
  })
  return res.json()
}

export async function uploadFileData(id: string, file: File, onProgress: (progress: number) => void) {
  const formData = new FormData()
  formData.append("file", file)

  const res = await axios.post(`${BASE_URL}/uploads/${id}/data`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    onUploadProgress: (progressEvent) => {
      const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || file.size))
      onProgress(percentCompleted)
    },
  })
  return res.data
}

export async function completeUpload(id: string) {
  const res = await fetch(`${BASE_URL}/uploads/${id}/complete`, { method: "PATCH" })
  return res.json()
}

export async function updateJobNode(id: string, nodeId: string | null) {
  const res = await fetch(`${BASE_URL}/jobs/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nodeId }),
  })
  return res.json()
}

// Update the pipeline stage of a job
export async function updateJobStage(id: string, stage: string) {
  const res = await fetch(`${BASE_URL}/jobs/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stage }),
  })
  return res.json()
}

// Fetch descriptive analytics summary from the backend
export async function fetchAnalyticsSummary() {
  const res = await fetch(`${BASE_URL}/analytics/summary`)
  return res.json()
}

// Fetch job duration prediction via linear regression model
export async function predictDuration(gpus: number, datasetSizeMB: number) {
  const res = await fetch(
    `${BASE_URL}/analytics/predict?gpus=${gpus}&datasetSize=${datasetSizeMB}`
  )
  return res.json()
}

// Fetch historical telemetry for a node (time-series data from DB)
export async function fetchTelemetryHistory(nodeName: string, minutes = 60) {
  const res = await fetch(
    `${BASE_URL}/analytics/telemetry-history?nodeName=${encodeURIComponent(nodeName)}&minutes=${minutes}`
  )
  return res.json()
}

// Fetch EDA report for an uploaded dataset (CSV profiling)
export async function fetchDatasetEda(sessionId: string) {
  const res = await fetch(`${BASE_URL}/analytics/eda/${sessionId}`)
  return res.json()
}