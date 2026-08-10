"use client"

import React, { useEffect, useState } from "react"
import { Key, Plus, Trash2, ShieldCheck, HelpCircle, Copy, Check, ShieldAlert } from "lucide-react"
import { 
  PageHeader, Panel, SectionHeader, LoadingState, EmptyState 
} from "../../../components/ui"

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

  if (loading) {
    return <LoadingState message="Retrieving configuration parameter settings..." />
  }

  return (
    <div className="space-y-8 flex-1 flex flex-col font-sans max-w-5xl w-full mx-auto">
      
      {/* Page Header */}
      <PageHeader 
        title="Settings" 
        subtitle="Manage workstation enrollment keys, setup guides, and organization configuration." 
      />

      {success && (
        <div className="p-4 rounded-xl border border-status-success/30 bg-status-success/5 text-status-success text-xs flex items-center space-x-2 shadow-sm font-medium">
          <ShieldCheck className="h-4 w-4 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl border border-error/30 bg-error/5 text-error text-sm flex items-center space-x-2 shadow-sm font-sans">
          <ShieldAlert className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Onboarding Guide Card */}
        <div className="space-y-4 lg:col-span-1">
          <SectionHeader title="Onboarding Guide" icon={HelpCircle} />
          <Panel className="p-5 space-y-4 text-sm text-on-surface-variant font-medium leading-relaxed">
            <p>
              To enroll new developer workstations into the organizational posture inventory, follow this sequence:
            </p>
            <ol className="list-decimal list-inside space-y-3 font-sans text-sm">
              <li>
                <span className="font-bold text-on-surface">Generate a token</span> using the keys panel.
              </li>
              <li>
                <span className="font-bold text-on-surface">Share the token</span> with developers (valid for 7 days).
              </li>
              <li>
                <span className="font-bold text-on-surface">Run the installation script</span> on the workstation:
                <pre className="mt-2.5 p-3 bg-terminal-black border border-outline-variant/40 rounded-lg text-xs font-mono text-on-surface whitespace-pre-wrap leading-relaxed select-all">
                  {`curl -fsSL http://localhost:8000/install.sh | env ENROLLMENT_TOKEN="<token>" bash`}
                </pre>
              </li>
            </ol>
          </Panel>
        </div>

        {/* Enrollment Tokens Card */}
        <div className="lg:col-span-2 space-y-4">
          <SectionHeader title="Enrollment Keys" />
          <Panel>
            <div className="px-5 py-3.5 border-b border-outline-variant/60 flex items-center justify-between bg-surface-container-low/40">
              <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider font-sans flex items-center space-x-2">
                <Key className="h-4 w-4 text-tertiary" />
                <span>Active Enrollment Keys</span>
              </span>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-tertiary hover:bg-white text-surface text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 shadow-sm"
              >
                <Plus className="h-4 w-4" />
                <span>{generating ? "Generating..." : "Generate Key"}</span>
              </button>
            </div>

            <div className="p-5">
              {tokens.length === 0 ? (
                <EmptyState 
                  title="No active enrollment keys" 
                  description="Generate a key above to start onboarding workstations." 
                  icon={Key}
                />
              ) : (
                <div className="overflow-x-auto border border-outline-variant/50 rounded-xl bg-surface-container-low">
                  <table className="w-full text-left border-collapse text-[13px]">
                    <thead>
                      <tr className="border-b border-outline-variant bg-surface-container-low/60 font-medium text-on-surface-variant uppercase tracking-wider text-xs font-sans">
                        <th className="py-3.5 px-5">Enrollment Key</th>
                        <th className="py-3.5 px-5 font-sans">Created</th>
                        <th className="py-3.5 px-5 font-sans">Expires</th>
                        <th className="py-3.5 px-5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/30 text-on-surface font-sans">
                      {tokens.map((token) => (
                        <tr key={token.id} className="hover:bg-surface-container-high/10 transition-colors">
                          <td className="py-3.5 px-5 font-mono text-xs text-on-surface">
                            <div className="flex items-center space-x-2">
                              <span className="truncate max-w-[180px] select-all">{token.token_hash}</span>
                              <button
                                onClick={() => copyToClipboard(token.token_hash)}
                                className="text-on-surface-variant hover:text-on-surface transition-colors"
                                title="Copy Key"
                              >
                                {copiedToken === token.token_hash ? (
                                  <Check className="h-4 w-4 text-status-success" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="py-3.5 px-5 text-on-surface-variant font-mono text-xs">
                            {new Date(token.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-3.5 px-5 text-on-surface-variant font-mono text-xs">
                            {new Date(token.expires_at).toLocaleDateString()}
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            <button
                              onClick={() => handleRevoke(token.id)}
                              className="inline-flex items-center space-x-1 text-error hover:text-red-400 transition-colors"
                              title="Revoke Token"
                            >
                              <Trash2 className="h-4.5 w-4.5" />
                              <span className="text-xs font-semibold font-sans">Revoke</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Panel>
        </div>

      </div>
    </div>
  )
}
