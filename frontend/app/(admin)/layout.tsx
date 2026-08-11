"use client"

import "../globals.css"
import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AppShell } from "../../components/ui"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem("flientsec_token")
    const email = localStorage.getItem("flientsec_email")
    if (!token) {
      router.push("/login")
    } else {
      setUserEmail(email)
      setAuthorized(true)
    }
  }, [router])

  useEffect(() => {
    document.documentElement.classList.add("dark")
    document.body.style.backgroundColor = "#0B0D0C"
    document.body.style.color = "#F1F5F2"
    return () => {
      document.documentElement.classList.remove("dark")
      document.body.style.backgroundColor = ""
      document.body.style.color = ""
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem("flientsec_token")
    localStorage.removeItem("flientsec_email")
    router.push("/login")
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-[#131317] flex items-center justify-center font-sans antialiased text-[#e5e1e7]">
        <p className="text-sm font-semibold text-on-surface-variant animate-pulse font-sans">Redirecting to login...</p>
      </div>
    )
  }

  return (
    <AppShell userEmail={userEmail} onLogout={handleLogout}>
      {children}
    </AppShell>
  )
}
