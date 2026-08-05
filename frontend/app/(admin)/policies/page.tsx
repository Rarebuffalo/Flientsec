"use client"

import React, { useEffect, useState } from "react"
import { ShieldCheck, ShieldAlert, Save, RefreshCw, AlertTriangle, FileCode } from "lucide-react"
import { 
  PageHeader, Panel, SectionHeader, LoadingState, StatusBadge 
} from "../../../components/ui"

export default function PolicyManager() {
  const [policy, setPolicy] = useState<any>(null)
  const [versions, setVersions] = useState<any[]>([])
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
  const hasPendingUpdate = latestVersion && policy && (
    latestVersion.id !== policy.active_version_id ||
    latestVersion.status === "DRAFT"
  )

  const activeVersion = versions.find(v => v.id === policy?.active_version_id)

  return (
    <div className="space-y-8 flex-1 flex flex-col font-sans">
      
      {/* Page Header */}
      <PageHeader 
        title="Security Policies" 
        subtitle="Define, publish, and activate workstation security baselines across the engineering fleet." 
      />

      {/* Active baseline check notifications */}
      {hasPendingUpdate && latestVersion && (
        <div className="p-4 rounded-xl border border-warning/35 bg-warning/5 text-warning text-xs flex items-start space-x-3 shadow-sm">
          <AlertTriangle className="h-4.5 w-4.5 text-warning flex-shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <p className="font-bold text-on-surface">Published version available</p>
            <p className="text-on-surface-variant font-medium leading-relaxed">
              v{latestVersion.version_number} is currently {latestVersion.status === "DRAFT" ? "a draft" : "published"} but not active. Workstations will continue evaluating against {activeVersion ? `v${activeVersion.version_number}` : "the previous active baseline"} until v{latestVersion.version_number} is activated.
            </p>
            {latestVersion.status === "PUBLISHED" && (
              <button 
                onClick={() => activateVersion(latestVersion.id)}
                disabled={activating !== null}
                className="mt-2 px-3 py-1 bg-tertiary hover:bg-white text-surface text-[10px] font-bold rounded transition-colors disabled:opacity-50"
              >
                {activating === latestVersion.id ? "Activating..." : `Activate v${latestVersion.version_number}`}
              </button>
            )}
          </div>
        </div>
      )}

      {!policy?.active_version_id && (
        <div className="p-4 rounded-xl border border-error/35 bg-error/5 text-error text-xs flex items-start space-x-3 shadow-sm">
          <AlertTriangle className="h-4.5 w-4.5 text-error flex-shrink-0 mt-0.5" />
          <div className="flex-1 space-y-0.5">
            <p className="font-bold text-on-surface">No active baseline</p>
            <p className="text-on-surface-variant font-medium">
              Workstation evaluation rules are published, but no specific policy version is currently active in the organization.
            </p>
          </div>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl border border-status-success/30 bg-status-success/5 text-status-success text-xs flex items-center space-x-2 shadow-sm font-medium">
          <ShieldCheck className="h-4 w-4 flex-shrink-0" />
          <span>Policies successfully updated and synchronized across the fleet workspace.</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl border border-error/30 bg-error/5 text-error text-xs flex items-center space-x-2 shadow-sm font-mono">
          <ShieldAlert className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Editor Area (Left 2 columns) */}
        <div className="lg:col-span-2 space-y-6">
          <Panel>
            <div className="px-5 py-4 border-b border-outline-variant/60 flex items-center justify-between bg-surface-container-low/40">
              <span className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider font-sans flex items-center space-x-2">
                <FileCode className="h-4 w-4 text-tertiary" />
                <span>policy.yaml (Draft configuration)</span>
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={fetchPolicy}
                  disabled={loading}
                  title="Reload baseline from database"
                  className="p-2 border border-outline-variant/60 text-on-surface-variant hover:text-on-surface rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </button>
                <button
                  onClick={savePolicy}
                  disabled={saving || loading}
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-tertiary hover:bg-white text-surface text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 shadow-sm"
                >
                  <Save className="h-4 w-4" />
                  <span>{saving ? "Saving..." : "Save Draft"}</span>
                </button>
              </div>
            </div>
            
            <div className="p-5 bg-terminal-black">
              <textarea
                value={yamlContent}
                onChange={(e) => setYamlContent(e.target.value)}
                className="w-full h-[380px] bg-terminal-black text-on-surface font-mono text-[13px] md:text-[14px] p-5 focus:outline-none focus:ring-1 focus:ring-tertiary border border-outline-variant/40 rounded-lg resize-none leading-relaxed"
                style={{ tabSize: 2 }}
                placeholder="# Define security posture configuration rules here"
              />
            </div>
          </Panel>

          {/* Version History Table */}
          <div className="space-y-4">
            <SectionHeader title="Policy Version History" />
            <Panel className="p-5">
              <div className="overflow-x-auto border border-outline-variant/50 rounded-lg bg-surface-container-low">
                <table className="w-full text-left border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-outline-variant bg-surface-container-low/60 font-semibold text-on-surface-variant uppercase tracking-wider text-xs font-sans">
                      <th className="px-5 py-3.5">Version</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5">Content Hash</th>
                      <th className="px-5 py-3.5">Created At</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/30 text-on-surface font-sans">
                    {versions.map((ver) => {
                      const isActive = policy?.active_version_id === ver.id
                      const formattedDate = ver.created_at
                        ? new Date(ver.created_at).toLocaleString()
                        : "unknown"
                      const shortHash = ver.content_hash
                        ? ver.content_hash.slice(0, 8)
                        : "N/A"

                      return (
                        <tr key={ver.id} className="hover:bg-surface-container-high/10 transition-colors">
                          <td className="px-5 py-3.5 font-mono font-bold text-on-surface">
                            v{ver.version_number}
                          </td>
                          <td className="px-5 py-3.5">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-semibold border ${
                                isActive
                                  ? "bg-status-success/15 text-status-success border-status-success/30"
                                  : ver.status === "PUBLISHED"
                                  ? "bg-tertiary/15 text-tertiary border-tertiary/30"
                                  : "bg-warning/15 text-warning border-warning/30"
                              }`}
                            >
                              {isActive ? "ACTIVE" : ver.status}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 font-mono text-xs text-on-surface-variant">
                            {shortHash}
                          </td>
                          <td className="px-5 py-3.5 text-on-surface-variant/80 font-mono text-xs">
                            {formattedDate}
                          </td>
                          <td className="px-5 py-3.5 text-right space-x-1.5">
                            {ver.content && (
                              <button
                                onClick={() => setYamlContent(ver.content)}
                                className="px-3 py-1.5 text-xs font-semibold border border-outline-variant/60 rounded bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors"
                              >
                                Inspect
                              </button>
                            )}
                            {ver.status === "DRAFT" && (
                              <button
                                onClick={() => publishVersion(ver.id)}
                                disabled={publishing !== null}
                                className="px-3 py-1.5 text-xs font-semibold bg-tertiary hover:bg-white text-surface rounded transition-colors disabled:opacity-50"
                              >
                                {publishing === ver.id ? "Publishing..." : "Publish"}
                              </button>
                            )}
                            {ver.status === "PUBLISHED" && !isActive && (
                              <button
                                onClick={() => activateVersion(ver.id)}
                                disabled={activating !== null}
                                className="px-3 py-1.5 text-xs font-semibold bg-status-success hover:bg-emerald-500 text-surface rounded transition-colors disabled:opacity-50"
                              >
                                {activating === ver.id ? "Activating..." : "Activate"}
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                    {versions.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-on-surface-variant">
                          No policy versions archived yet. Save rules above to commit draft v1.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        </div>

        {/* SECTION 4 - RULE GUIDANCE (Right 1 column) */}
        <div className="space-y-4">
          <SectionHeader title="Rule Syntax Guidelines" />
          <Panel className="p-5 space-y-4 text-xs leading-relaxed text-on-surface-variant">
            <p>
              FlientSec posture rules are defined in standard YAML notation.
            </p>
            <div className="space-y-3.5">
              <div>
                <p className="font-bold text-on-surface">1. Supported Checks</p>
                <p className="mt-1">Each policy constraint rule configures a check properties block:</p>
                <ul className="list-disc pl-4 mt-1 space-y-1.5 font-mono text-[10px]">
                  <li><span className="text-on-surface font-semibold">enabled</span>: true / false</li>
                  <li><span className="text-on-surface font-semibold">required</span>: true / false</li>
                  <li><span className="text-on-surface font-semibold">severity</span>: HIGH, MEDIUM, LOW</li>
                </ul>
              </div>

              <div>
                <p className="font-bold text-on-surface">2. Version Constraints</p>
                <p className="mt-1">Runtimes and applications support boundary comparisons:</p>
                <ul className="list-disc pl-4 mt-1 space-y-1.5 font-mono text-[10px]">
                  <li><span className="text-on-surface font-semibold">minimum</span>: SemVer string (e.g. "22.0.0")</li>
                </ul>
              </div>

              <div>
                <p className="font-bold text-on-surface">3. Score Deduction Impact</p>
                <p className="mt-1">Workstation checks failing decrease the score based on severity:</p>
                <ul className="list-disc pl-4 mt-1 space-y-1 text-on-surface-variant">
                  <li><span className="font-mono text-on-surface font-bold">LOW</span>: -10 points</li>
                  <li><span className="font-mono text-warning font-bold">MEDIUM</span>: -20 points</li>
                  <li><span className="font-mono text-error font-bold">HIGH</span>: -40 points</li>
                </ul>
              </div>
            </div>
            
            <div className="p-3 border border-outline-variant/40 rounded-lg bg-surface-container-low/40">
              <p className="font-bold text-on-surface">Synchronization</p>
              <p className="mt-1 text-[10px]">
                Enrolled daemons pull, parse, and enforce active rules within 60 seconds of client handshake connection.
              </p>
            </div>
          </Panel>
        </div>

      </div>
    </div>
  )
}
