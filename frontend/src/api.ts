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