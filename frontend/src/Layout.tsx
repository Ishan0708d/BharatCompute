import { Link, useLocation, Outlet } from "react-router-dom"
import { auth } from "./firebase"
import { signOut } from "firebase/auth"

export default function Layout() {
  const location = useLocation()
  const activeTab = location.pathname

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <h1 className="text-xl font-bold text-blue-400 flex items-center gap-2">
            ⚡ BharatCompute
            <span className="flex items-center gap-1 text-xs font-normal text-green-400 bg-green-900/50 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse inline-block" />
              Live
            </span>
          </h1>
          <nav className="flex gap-4">
            {[
            { path: "/dashboard", label: "Dashboard" },
              { path: "/jobs", label: "Job Canvas" },
              { path: "/uploads", label: "Uploads" },
              { path: "/analytics", label: "Analytics" }
            ].map(tab => (
              <Link
                key={tab.path}
                to={tab.path}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  activeTab === tab.path
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-xs text-gray-500 hidden md:block">
            🇮🇳 India National GPU Grid &nbsp;·&nbsp; 34,000+ Nodes
          </div>
          <button 
            onClick={() => signOut(auth)}
            className="text-xs text-gray-400 hover:text-red-400 transition-colors bg-gray-800 px-3 py-1.5 rounded-full border border-gray-700"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="p-6">
        <Outlet />
      </main>
    </div>
  )
}
