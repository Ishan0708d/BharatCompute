import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { auth } from "./firebase"
import { onAuthStateChanged, type User } from "firebase/auth"

interface AuthContextType {
  currentUser: User | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({ currentUser: null, loading: true })

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      setCurrentUser(user)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  return (
    <AuthContext.Provider value={{ currentUser, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  )
}
