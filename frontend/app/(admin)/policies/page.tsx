"use client"

import React, { useEffect, useState } from "react"
import { ShieldCheck, RotateCw, Save } from "lucide-react"
import {
  PageHeader, LoadingState, StatusBadge
} from "../../../components/ui"

interface PolicyVersion {
  id: string
  version_number: number
  status: "DRAFT" | "PUBLISHED"
  content: string
  content_hash: string
  created_at: string
}

export default function PolicyManager() {
  const [policy, setPolicy] = useState<any>(null)
  const [versions, setVersions] = useState<PolicyVersion[]>([])
  const [yamlContent, setYamlContent] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState<string | null>(null)
  const [activating, setActivating] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

  const fetchPolicy = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem("flientsec_token")
      if (!token) {
        setError("No session active. Redirecting...")
        return
      }
      const headers = { Authorization: `Bearer ${token}` }

      const res = await fetch(`${apiUrl}/api/v1/policies`, { headers })
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem("flientsec_token")
          window.location.href = "/login"
          return
        }
        throw new Error("Failed to load policy rules from server.")
      }
      const policyData = await res.json()
      setPolicy(policyData)
      setYamlContent(policyData.rules_yaml)

      const versionsRes = await fetch(`${apiUrl}/api/v1/policies/${policyData.id}/versions`, { headers })
      if (versionsRes.ok) {
        const versionsData = await versionsRes.json()
        setVersions(versionsData)
      }
      setError(null)
    } catch (err: any) {
      setError(err.message || "An error occurred while loading policies.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPolicy()
  }, [apiUrl])

  const savePolicy = async () => {
    try {
      setSaving(true)
      setSuccess(false)
      setError(null)

      const token = localStorage.getItem("flientsec_token")
      if (!token) {
        throw new Error("Session expired. Please sign in again.")
      }

      const res = await fetch(`${apiUrl}/api/v1/policies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ rules_yaml: yamlContent })
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.detail || "Failed to update organizational policy.")
      }

      setSuccess(true)
      fetchPolicy()
    } catch (err: any) {
      setError(err.message || "An error occurred while saving the policy.")
    } finally {
      setSaving(false)
    }
  }

  const publishVersion = async (versionId: string) => {
    try {
      setPublishing(versionId)
      setError(null)
      setSuccess(false)
      const token = localStorage.getItem("flientsec_token")
      if (!token) throw new Error("Session expired. Please sign in again.")

      const res = await fetch(`${apiUrl}/api/v1/policies/${policy.id}/versions/${versionId}/publish`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.detail || "Failed to publish version.")
      }
      setSuccess(true)
      await fetchPolicy()
    } catch (err: any) {
      setError(err.message || "An error occurred while publishing version.")
    } finally {
      setPublishing(null)
    }
  }

  const activateVersion = async (versionId: string) => {
    try {
      setActivating(versionId)
      setError(null)
      setSuccess(false)
      const token = localStorage.getItem("flientsec_token")
      if (!token) throw new Error("Session expired. Please sign in again.")

      const res = await fetch(`${apiUrl}/api/v1/policies/${policy.id}/activate?version_id=${versionId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.detail || "Failed to activate version.")
      }
      setSuccess(true)
      await fetchPolicy()
    } catch (err: any) {
      setError(err.message || "An error occurred while activating version.")
    } finally {
      setActivating(null)
    }
  }

  if (loading) {
    return <LoadingState message="Retrieving safety policy definitions..." />
  }

  const latestVersion = versions[0]
  const activeVersion = versions.find(v => v.id === policy?.active_version_id)
  const activeVersionNumber = activeVersion ? activeVersion.version_number : 1

  // Static rules list matching design specification
  const staticRules = [
    { name: "Firewall enabled", key: "firewall.enabled", sev: "HIGH", required: true },
    { name: "Disk encryption", key: "disk.encryption", sev: "HIGH", required: true },
    { name: "SSH root login disabled", key: "ssh.root_login", sev: "LOW", required: true },
    { name: "System updates current", key: "updates.current", sev: "MEDIUM", required: true },
    { name: "Node.js minimum version", key: "node.minimum_version", sev: "MEDIUM", required: false },
    { name: "Docker installed", key: "docker.installed", sev: "LOW", required: false }
  ]

  // Render raw YAML code line by line with numbers
  const yamlLines = yamlContent.split("\n")

  return (
    <div className="space-y-8 flex-1 flex flex-col font-sans">

      {/* Page Header */}
      <PageHeader
        title="Policies"
        subtitle="The security standard your fleet is evaluated against."
      />

      {success && (
        <div className="panel p-5 border border-success/30 bg-success/5 text-success flex items-center space-x-2 text-sm font-medium">
          <ShieldCheck className="h-4 w-4" />
          <span>Policies successfully updated and synchronized across the fleet workspace.</span>
        </div>
      )}

      {error && (
        <div className="panel p-5 border border-danger/30 bg-danger/5 text-danger flex items-center space-x-2 text-sm font-medium">
          <span>{error}</span>
        </div>
      )}

      {/* POLICY HERO */}
      <div className="section">
        <div className="panel policy-hero">
          <div>
            <div style={{ fontSize: "19px", fontWeight: 700 }}>{policy?.name || "Baseline Policy"}</div>
            <div className="secondary-text text-xs mt-1.5">
              Default policy · applied fleet-wide unless overridden
            </div>
          </div>
          <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>Active version</div>
              <div style={{ fontSize: "16px", fontWeight: 700 }} className="mono">
                v{activeVersionNumber}
              </div>
            </div>
            <div className="roadmap-note">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" style={{ width: "13px", height: "13px" }}>
                <path d="M12 2 3 6v6c0 5 4 8.5 9 10 5-1.5 9-5 9-10V6l-9-4Z"/>
              </svg>
              Immutable · published
            </div>
          </div>
        </div>
      </div>

      {/* RULES LIST */}
      <div className="section">
        <div className="section-head">
          <div className="section-title">Rules — v{activeVersionNumber}</div>
          <div className="section-hint">{staticRules.length} rules</div>
        </div>
        <div className="rule-list">
          {staticRules.map((r, idx) => (
            <div className="rule-row" key={idx}>
              <div>
                <div className="rule-name">{r.name}</div>
                <div className="rule-key">{r.key}</div>
              </div>
              <span className={`sev ${r.sev === "HIGH" ? "sev-high" : r.sev === "MEDIUM" ? "sev-medium" : "sev-low"}`}>
                {r.sev}
              </span>
              <span className="badge badge-neutral">{r.required ? "Required" : "Optional"}</span>
              <span></span>
            </div>
          ))}
        </div>
      </div>

      {/* POLICY SOURCE EDITOR */}
      <div className="section">
        <div className="section-head">
          <div className="section-title">Policy source</div>
          <div className="section-hint">Read-only · YAML draft</div>
        </div>
        <div className="code-block" style={{ padding: "16px 0" }}>
          {yamlLines.map((line, idx) => {
            // Very basic syntax styling
            let formattedLine = line
            if (line.includes("#")) {
              formattedLine = `<span class="cm">${line}</span>`
            } else if (line.includes(":")) {
              const parts = line.split(":")
              const key = parts[0]
              const val = parts.slice(1).join(":")
              formattedLine = `<span class="kk">${key}</span>:<span class="vv">${val}</span>`
            }

            return (
              <div className="code-line" key={idx}>
                <span className="num">{idx + 1}</span>
                <span className="txt" dangerouslySetInnerHTML={{ __html: formattedLine }}></span>
              </div>
            )
          })}
        </div>
      </div>

      {/* VERSIONS */}
      <div className="section">
        <div className="section-head">
          <div className="section-title">Versions</div>
        </div>
        <div className="table-wrap">
          <table>
            <tbody>
              {versions.map((v) => {
                const isActive = policy?.active_version_id === v.id
                return (
                  <tr key={v.id}>
                    <td data-label="Version" className="mono cell-primary" style={{ width: "8%" }}>
                      v{v.version_number}
                    </td>
                    <td data-label="Status">
                      {isActive ? (
                        <span className="badge badge-compliant"><span className="dot"></span>Active</span>
                      ) : (
                        <span className="badge badge-neutral">{v.status}</span>
                      )}
                    </td>
                    <td data-label="Note" className="secondary-text">
                      {v.status === "DRAFT" ? "Draft configuration" : `Baseline release v${v.version_number}`}
                    </td>
                    <td data-label="Published" className="muted" style={{ textAlign: "right" }}>
                      {new Date(v.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ASSIGNMENTS */}
      <div className="section" style={{ marginBottom: 0 }}>
        <div className="section-head">
          <div className="section-title">Assignments</div>
        </div>
        <div className="panel flex justify-between items-center flex-wrap gap-4">
          <div className="secondary-text" style={{ fontSize: "13.3px" }}>
            All workstations are assigned the default policy. No device-level overrides.
          </div>
          <span className="badge badge-neutral">Default for all devices</span>
        </div>
      </div>
    </div>
  )
}
