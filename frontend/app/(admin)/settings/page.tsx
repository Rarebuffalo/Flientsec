"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { RotateCw, Check, Copy } from "lucide-react"
import {
  PageHeader, LoadingState, EmptyState
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
  const router = useRouter()
  const [tokens, setTokens] = useState<EnrollmentToken[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

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
          router.push("/login")
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
      setTokens((prev) => [newToken, ...prev])
      showToast("Token generated")
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
      showToast("Token revoked")
    } catch (err: any) {
      setError(err.message || "Failed to revoke enrollment token.")
    }
  }

  const copyToClipboard = (text: string, msg: string = "Copied to clipboard") => {
    navigator.clipboard.writeText(text)
    setCopiedToken(text)
    showToast(msg)
    setTimeout(() => setCopiedToken(null), 2000)
  }

  const showToast = (msg: string) => {
    setToastMsg(msg)
    const t = document.getElementById("toast")
    if (t) {
      t.classList.add("show")
      setTimeout(() => t.classList.remove("show"), 1800)
    }
  }

  if (loading) {
    return <LoadingState message="Retrieving configuration settings..." />
  }

  return (
    <div className="space-y-8 flex-1 flex flex-col font-sans">

      {/* Page Header */}
      <PageHeader
        title="Settings"
        subtitle="Enroll new workstations and manage onboarding."
      />

      {error && (
        <div className="panel p-5 border border-danger/30 bg-danger/5 text-danger flex items-center justify-between text-sm font-medium">
          <span>{error}</span>
          <button onClick={fetchTokens} className="btn btn-sm">Retry</button>
        </div>
      )}

      {/* ENROLLMENT TOKENS */}
      <div className="section">
        <div className="section-head">
          <div className="section-title">Enrollment tokens</div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="btn btn-primary btn-sm"
          >
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" style={{ width: "14px", height: "14px", stroke: "currentColor" }}>
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Generate token
          </button>
        </div>

        <div className="table-wrap">
          {tokens.length === 0 ? (
            <div className="empty">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" className="h-6 w-6 text-text-muted mb-3 mx-auto">
                <path d="M9 21H5a2 2 0 0 1-2-2V9l4-5h10l4 5v10a2 2 0 0 1-2 2h-4"/>
                <path d="M3 9h18"/>
              </svg>
              <div className="empty-title">No active tokens</div>
              <div className="empty-body">Generate one to enroll a new workstation.</div>
            </div>
          ) : (
            <table>
              <tbody>
                {tokens.map((t) => {
                  const isExpired = new Date(t.expires_at).getTime() < Date.now()
                  const displayHash = t.token_hash.slice(0, 16) + "..."
                  return (
                    <tr key={t.id}>
                      <td data-label="Token" className="cell-primary font-mono text-xs">
                        {displayHash}
                      </td>
                      <td data-label="Created" className="muted">
                        {new Date(t.created_at).toLocaleDateString()}
                      </td>
                      <td data-label="Expires">
                        {isExpired ? (
                          <span className="badge badge-neutral" style={{ color: "var(--danger)" }}>Expired</span>
                        ) : (
                          <span className="badge badge-neutral">
                            {new Date(t.expires_at).toLocaleDateString()}
                          </span>
                        )}
                      </td>
                      <td data-label="Actions" style={{ textAlign: "right" }} className="space-x-2">
                        <button
                          onClick={() => copyToClipboard(t.token_hash, "Token copied")}
                          className="btn btn-ghost btn-sm"
                        >
                          Copy
                        </button>
                        <button
                          onClick={() => handleRevoke(t.id)}
                          className="btn btn-ghost btn-sm text-danger"
                        >
                          Revoke
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* INSTALL THE AGENT */}
      <div className="section">
        <div className="section-head">
          <div className="section-title">Install the agent</div>
        </div>
        <div className="panel">
          <div className="step">
            <div className="step-num">1</div>
            <div>
              <div className="step-title">Generate an enrollment token</div>
              <div className="step-body">Tokens are single-use and expire after 24 hours. Generate one above for each new workstation.</div>
            </div>
          </div>
          <div className="step">
            <div className="step-num">2</div>
            <div>
              <div className="step-title">Install the agent</div>
              <div className="step-body">Run this on the target workstation:</div>
              <div
                className="copy-row cursor-pointer group"
                onClick={() => copyToClipboard(`curl -fsSL ${apiUrl}/install.sh | sh`, "Copied installer command")}
              >
                <span>curl -fsSL {apiUrl}/install.sh | sh</span>
                <button className="btn btn-ghost btn-sm copy-btn">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" style={{ width: "14px", height: "14px" }}>
                    <rect x="9" y="9" width="12" height="12" rx="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <div className="step" style={{ marginBottom: 0 }}>
            <div className="step-num">3</div>
            <div>
              <div className="step-title">Register with your token</div>
              <div className="step-body">Complete enrollment using the token generated in step 1:</div>
              <div
                className="copy-row cursor-pointer group"
                onClick={() => copyToClipboard(`flientsec-agent enroll --token=<ENROLLMENT_TOKEN>`, "Copied enroll command")}
              >
                <span>flientsec-agent enroll --token=&lt;ENROLLMENT_TOKEN&gt;</span>
                <button className="btn btn-ghost btn-sm copy-btn">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" style={{ width: "14px", height: "14px" }}>
                    <rect x="9" y="9" width="12" height="12" rx="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                </button>
              </div>
              <div className="secondary-text text-xs mt-2">
                Once registered, the workstation appears under <b className="text-text-secondary">Devices</b> within a few seconds.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ROADMAP NOTES */}
      <div className="section" style={{ marginBottom: 0 }}>
        <div className="roadmap-note">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" style={{ width: "13px", height: "13px", stroke: "currentColor" }}>
            <circle cx="12" cy="12" r="9"/>
            <path d="M12 8v5M12 16h.01"/>
          </svg>
          SSO, notifications, and scheduled reports are on the roadmap — not yet available.
        </div>
      </div>

      {/* Toast popup */}
      <div className="toast" id="toast">
        <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.5">
          <path d="M20 6 9 17l-5-5"/>
        </svg>
        <span>{toastMsg || "Copied"}</span>
      </div>
    </div>
  )
}
