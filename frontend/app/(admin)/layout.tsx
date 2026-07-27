"use client"

import "../globals.css"
import React, { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

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

  const handleLogout = () => {
    localStorage.removeItem("flientsec_token")
    localStorage.removeItem("flientsec_email")
    router.push("/login")
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center font-sans antialiased text-slate-800">
        <p className="text-sm font-semibold text-slate-400 animate-pulse">Redirecting to login...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Main Navbar */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link href="/dashboard" className="flex items-center space-x-2.5">
              <img src="/logo_dark.png" alt="FlientSec Logo" className="h-7 w-7 object-contain" />
              <span className="font-extrabold tracking-tight text-2xl text-slate-900 bg-gradient-to-r from-slate-950 to-emerald-950 bg-clip-text text-transparent">FlientSec</span>
            </Link>
            <nav className="flex space-x-4">
              <Link
                href="/dashboard"
                className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/policies"
                className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
              >
                Policies
              </Link>
              <Link
                href="/settings"
                className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
              >
                Settings
              </Link>
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-xs text-slate-500 border border-slate-200 px-2.5 py-0.5 rounded-full bg-white">
              Default Org
            </span>
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-full bg-[#2D8C74] text-white flex items-center justify-center text-xs font-bold uppercase">
                {userEmail ? userEmail.slice(0, 2) : "AD"}
              </div>
              <div className="hidden md:block mr-2">
                <p className="text-xs font-medium leading-none text-slate-900">Administrator</p>
                <p className="text-[10px] text-slate-400 leading-none mt-1">{userEmail || "admin@flientsec.local"}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="text-xs font-bold text-[#6B7280] hover:text-[#111827] transition-colors border border-slate-200 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 shadow-sm"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 text-center text-xs text-slate-400 bg-white">
        <p>© 2026 FlientSec. All rights reserved.</p>
      </footer>
    </div>
  )
}
