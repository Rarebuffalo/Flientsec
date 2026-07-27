"use client"

import React, { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Shield, ShieldAlert, Check } from "lucide-react"

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // 1. Signup Request
      const regRes = await fetch(`${apiUrl}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email,
          password: password,
        }),
      })

      if (!regRes.ok) {
        if (regRes.status === 409) {
          throw new Error("This email is already registered.")
        }
        throw new Error("Failed to register account.")
      }

      // 2. Automated Login Handshake
      const loginRes = await fetch(`${apiUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          username: email,
          password: password,
        }),
      })

      if (!loginRes.ok) {
        throw new Error("Registration succeeded, but auto-login failed. Please sign in manually.")
      }

      const tokenData = await loginRes.json()
      localStorage.setItem("flientsec_token", tokenData.access_token)
      localStorage.setItem("flientsec_email", email)
      router.push("/dashboard")
    } catch (err: any) {
      setError(err.message || "An error occurred during registration.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F9F8] flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans antialiased text-slate-800">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-flex items-center space-x-2.5">
          <img src="/logo_dark.png" alt="FlientSec Logo" className="h-8 w-8 object-contain" />
          <span className="font-extrabold tracking-tight text-2xl text-slate-900">FlientSec</span>
        </Link>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900 tracking-tight">
          Create your workspace
        </h2>
        <p className="mt-2 text-center text-sm text-[#6B7280]">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-[#2D8C74] hover:text-[#12372A] transition-colors">
            Sign in
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 border border-slate-200 rounded-xl shadow-sm sm:px-10">
          <form className="space-y-6" onSubmit={handleRegister}>
            {error && (
              <div className="p-4 rounded-lg border border-danger/30 bg-danger/5 text-sm text-[#B91C1C] flex items-center space-x-2">
                <ShieldAlert className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Email Address
              </label>
              <div className="mt-2">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-3.5 py-2.5 border border-slate-200 rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent text-sm"
                  placeholder="name@company.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Password
              </label>
              <div className="mt-2">
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3.5 py-2.5 border border-slate-200 rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2.5 text-xs text-[#6B7280] font-medium">
              <p className="font-bold text-slate-700">Workspace Defaults Included:</p>
              <div className="flex items-center space-x-2">
                <Check className="h-4 w-4 text-[#2D8C74]" />
                <span>Personal Organization Workspace</span>
              </div>
              <div className="flex items-center space-x-2">
                <Check className="h-4 w-4 text-[#2D8C74]" />
                <span>Baseline Workstation Security Policy</span>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-xs font-bold text-white bg-[#2D8C74] hover:bg-[#12372A] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-800 transition-colors disabled:opacity-50"
              >
                {loading ? "Registering..." : "Create Account & Workspace"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
