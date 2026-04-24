import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import type { ReactNode } from "react"
import { AuthProvider, useAuth } from "./AuthContext"
import Auth from "./pages/Auth"
import Layout from "./Layout"
import Dashboard from "./pages/Dashboard"
import JobCanvas from "./pages/JobCanvas"
import Uploads from "./pages/Uploads"
import Analytics from "./pages/Analytics"

function AuthGuard({ children }: { children: ReactNode }) {
  const { currentUser, loading } = useAuth()
  if (loading) return null
  return currentUser ? <>{children}</> : <Navigate to="/login" />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Auth />} />
          
          <Route path="/" element={
            <AuthGuard>
              <Layout />
            </AuthGuard>
          }>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="jobs" element={<JobCanvas />} />
            <Route path="uploads" element={<Uploads />} />
            <Route path="analytics" element={<Analytics />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}