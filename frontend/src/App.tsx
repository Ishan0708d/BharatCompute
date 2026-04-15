import { useState } from "react"
import Dashboard from "./pages/Dashboard"
import JobCanvas from "./pages/JobCanvas"
import Uploads from "./pages/Uploads"

const tabs = ["Dashboard", "Job Canvas", "Uploads"]

export default function App() {
  const [activeTab, setActiveTab] = useState("Dashboard")

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center gap-8">
        <h1 className="text-xl font-bold text-blue-400">⚡ BharatCompute</h1>
        <nav className="flex gap-4">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </header>

      <main className="p-6">
        {activeTab === "Dashboard" && <Dashboard />}
        {activeTab === "Job Canvas" && <JobCanvas />}
        {activeTab === "Uploads" && <Uploads />}
      </main>
    </div>
  )
}