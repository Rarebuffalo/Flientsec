"use client"

import React, { useEffect, useState } from "react"
import { Key, Plus, Trash2, ShieldCheck, HelpCircle, Copy, Check } from "lucide-react"

interface EnrollmentToken {
  id: string
  organization_id: string
  token_hash: string
  created_by: string
  expires_at: string
  created_at: string
}

export default function SettingsPage() {
  const [tokens, setTokens] = useState<EnrollmentToken[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

  const fetchTokens = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem("flientsec_token")
      if (!token) {
        setError("No active session. Redirecting...")
        return
      }

      const res = await fetch(`${apiUrl}/api/v1/enrollment-tokens`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem("flientsec_token")
          window.location.href = "/login"
          return
        }
        throw new Error("Failed to load enrollment tokens.")
      }
      const data = await res.json()
      setTokens(data)
      setError(null)
    } catch (err: any) {
      setError(err.message || "An error occurred while loading settings.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTokens()
  }, [apiUrl])

  const handleGenerate = async () => {
    try {
      setGenerating(true)
      setError(null)
      setSuccess(null)

      const token = localStorage.getItem("flientsec_token")
      if (!token) {
        throw new Error("Session expired. Please log in again.")
      }

      // Calculate expiration date (7 days from now)
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7)

      const res = await fetch(`${apiUrl}/api/v1/enrollment-tokens`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          expires_at: expiresAt.toISOString(),
        }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || "Failed to generate enrollment token.")
      }

      const newToken = await res.json()
      setTokens((prev) => [...prev, newToken])
      setSuccess("Enrollment token successfully generated.")
    } catch (err: any) {
      setError(err.message || "Failed to generate enrollment token.")
    } finally {
      setGenerating(false)
    }
  }

  const handleRevoke = async (tokenId: string) => {
    if (!confirm("Are you sure you want to revoke this enrollment token? Any installer using it will fail to register new devices.")) {
      return
    }

    try {
      setError(null)
      setSuccess(null)
      const token = localStorage.getItem("flientsec_token")
      const res = await fetch(`${apiUrl}/api/v1/enrollment-tokens/${tokenId}/revoke`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok) {
        throw new Error("Failed to revoke enrollment token.")
      }

      setTokens((prev) => prev.filter((t) => t.id !== tokenId))
      setSuccess("Enrollment token revoked successfully.")
    } catch (err: any) {
      setError(err.message || "Failed to revoke enrollment token.")
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedToken(text)
    setTimeout(() => setCopiedToken(null), 2000)
  }

  return (
    <div className="space-y-8 flex-1 flex flex-col">
      {/* Header bar */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-1 font-medium">
          Manage workstation onboarding keys, setup configurations, and organizational parameters.
        </p>
      </div>

      {success && (
        <div className="p-4 rounded-lg border border-success/30 bg-success/5 text-success text-sm flex items-center space-x-2">
          <ShieldCheck className="h-4 w-4 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg border border-danger/30 bg-danger/5 text-danger text-sm flex items-center space-x-2">
          <span className="font-semibold">Error:</span>
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Onboarding Guide Card */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-6 shadow-premium">
          <h2 className="text-sm font-bold uppercase tracking-wider border-b border-slate-200 pb-3 flex items-center space-x-2 text-slate-700">
            <HelpCircle className="h-4 w-4" />
            <span>Onboarding Guide</span>
          </h2>
          <div className="space-y-4 text-xs font-mono text-slate-600">
            <p className="leading-relaxed">
              To enroll developer workstations, follow these steps:
            </p>
            <ol className="list-decimal list-inside space-y-3 font-sans text-sm">
              <li>
                <span className="font-semibold text-slate-900">Generate a token</span> using the panel on the right.
              </li>
              <li>
                <span className="font-semibold text-slate-900">Share the token</span> with developers (valid for 7 days).
              </li>
              <li>
                <span className="font-semibold text-slate-900">Run registration</span> inside the workstation daemon:
                <pre className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 whitespace-pre-wrap leading-tight">
                  {`curl -fsSL http://localhost:8000/install.sh | env ENROLLMENT_TOKEN="<token>" bash`}
                </pre>
              </li>
            </ol>
          </div>
        </div>

        {/* Enrollment Tokens Card */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg shadow-premium">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <h2 className="text-sm font-bold uppercase tracking-wider flex items-center space-x-2 text-slate-700">
              <Key className="h-4 w-4" />
              <span>Enrollment Keys</span>
            </h2>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#12372A] hover:bg-emerald-950 text-white text-xs font-bold rounded-lg transition-colors shadow-sm disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{generating ? "Generating..." : "Generate Key"}</span>
            </button>
          </div>

          <div className="p-6">
            {loading ? (
              <p className="text-slate-400 text-center text-sm py-4 animate-pulse">Loading active tokens...</p>
            ) : tokens.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                <p className="font-semibold text-slate-800">No active enrollment keys</p>
                <p className="text-xs mt-1">Generate a key above to start onboarding workstations.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-left font-sans">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-400">
                      <th className="py-3 px-4">Enrollment Key</th>
                      <th className="py-3 px-4">Created At</th>
                      <th className="py-3 px-4">Expires At</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tokens.map((token) => (
                      <tr key={token.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-4 font-mono text-slate-900 flex items-center space-x-2">
                          <span className="truncate max-w-[180px]">{token.token_hash}</span>
                          <button
                            onClick={() => copyToClipboard(token.token_hash)}
                            className="text-slate-400 hover:text-slate-900 transition-colors"
                            title="Copy Key"
                          >
                            {copiedToken === token.token_hash ? (
                              <Check className="h-3.5 w-3.5 text-success" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </td>
                        <td className="py-4 px-4 text-slate-500">
                          {new Date(token.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-4 px-4 text-slate-500">
                          {new Date(token.expires_at).toLocaleDateString()}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <button
                            onClick={() => handleRevoke(token.id)}
                            className="inline-flex items-center space-x-1 text-danger hover:text-red-800 transition-colors"
                            title="Revoke Token"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="text-xs font-bold">Revoke</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
