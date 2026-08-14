"use client"

import React, { useEffect, useState } from "react"
import { ShieldCheck, RotateCw, Save, History, AlertTriangle, ArrowLeftRight } from "lucide-react"
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
  definition_json?: string
}

export default function PolicyManager() {
  const [policy, setPolicy] = useState<any>(null)
  const [versions, setVersions] = useState<PolicyVersion[]>([])
  const [yamlContent, setYamlContent] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState<string | null>(null)
  const [activating, setActivating] = useState<string | null>(null)
  const [rollingBack, setRollingBack] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [success, setSuccess] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Rollback Modal State
  const [targetRollbackVersion, setTargetRollbackVersion] = useState<PolicyVersion | null>(null)

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

  const inspectVersion = (content: string) => {
    setYamlContent(content)
    setIsEditing(true)
    setSuccess(false)
    setError(null)
  }

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

      setSuccessMsg("Policy draft saved successfully.")
      setSuccess(true)
      setIsEditing(false)
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
      setSuccessMsg("Policy version published.")
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
      setSuccessMsg("Policy version activated.")
      setSuccess(true)
      await fetchPolicy()
    } catch (err: any) {
      setError(err.message || "An error occurred while activating version.")
    } finally {
      setActivating(null)
    }
  }

  const executeRollback = async () => {
    if (!targetRollbackVersion) return
    try {
      setRollingBack(true)
      setError(null)
      setSuccess(false)
      const token = localStorage.getItem("flientsec_token")
      if (!token) throw new Error("Session expired. Please sign in again.")

      const res = await fetch(
        `${apiUrl}/api/v1/policies/${policy.id}/rollback?target_version_id=${targetRollbackVersion.id}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` }
        }
      )

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.detail || "Failed to execute policy rollback.")
      }

      setSuccessMsg(`Active policy successfully rolled back to Version ${targetRollbackVersion.version_number}.`)
      setSuccess(true)
      setTargetRollbackVersion(null)
      await fetchPolicy()
    } catch (err: any) {
      setError(err.message || "An error occurred while executing rollback.")
    } finally {
      setRollingBack(false)
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

  // Dynamic rules list matching active version's definition
  const getRulesFromDefinition = (definitionJson: string) => {
    try {
      const data = JSON.parse(definitionJson)
      if (data && data.checks) {
        return Object.entries(data.checks).map(([key, value]: [string, any]) => {
          let name = key.charAt(0).toUpperCase() + key.slice(1)
          if (key === "firewall") name = "Firewall enabled"
          if (key === "encryption") name = "Disk encryption"
          if (key === "ssh") name = "SSH root login disabled"
          if (key === "updates") name = "System updates current"
          if (key === "runtime") name = "Runtime security status"

          let checkKey = `${key}.enabled`
          if (typeof value === "object") {
            const innerKeys = Object.keys(value).filter(k => k !== "severity" && k !== "required")
            if (innerKeys.length > 0) {
              checkKey = `${key}.${innerKeys[0]}`
            }
          }

          return {
            name,
            key: checkKey,
            sev: value.severity || "LOW",
            required: value.required !== false
          }
        })
      }
    } catch (e) {
      // Fallback
    }
    return null
  }

  const parsedRules = activeVersion?.definition_json ? getRulesFromDefinition(activeVersion.definition_json) : null
  const rulesToDisplay = parsedRules || staticRules

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
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span>{successMsg || "Policies successfully updated and synchronized across the fleet workspace."}</span>
        </div>
      )}

      {error && (
        <div className="panel p-5 border border-danger/30 bg-danger/5 text-danger flex items-center space-x-2 text-sm font-medium">
          <span>{error}</span>
        </div>
      )}

      {/* ACTIVE STANDARD */}
      <div className="section">
        <div className="section-head">
          <div>
            <div className="section-title">Active standard</div>
            <div className="secondary-text text-xs mt-0.5">
              Workstations re-evaluate on each check-in against this standard.
            </div>
          </div>
          <span className="badge badge-neutral text-xs">Version {activeVersionNumber} · Active</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: "35%" }}>Rule</th>
                <th style={{ width: "25%" }}>Key</th>
                <th style={{ width: "20%" }}>Severity</th>
                <th style={{ width: "20%", textAlign: "right" }}>Requirement</th>
              </tr>
            </thead>
            <tbody>
              {rulesToDisplay.map((r) => (
                <tr key={r.key}>
                  <td data-label="Rule" className="cell-primary font-medium">
                    {r.name}
                  </td>
                  <td data-label="Key" className="mono muted text-xs">
                    {r.key}
                  </td>
                  <td data-label="Severity">
                    <span
                      className="badge"
                      style={{
                        background: r.sev === "HIGH" ? "rgba(239, 68, 68, 0.12)" : r.sev === "MEDIUM" ? "rgba(245, 158, 11, 0.12)" : "rgba(148, 163, 184, 0.12)",
                        color: r.sev === "HIGH" ? "#EF4444" : r.sev === "MEDIUM" ? "#F59E0B" : "#94A3B8"
                      }}
                    >
                      {r.sev}
                    </span>
                  </td>
                  <td data-label="Requirement" style={{ textAlign: "right" }}>
                    <span className="badge badge-neutral text-xs">
                      {r.required ? "Required" : "Optional"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* POLICY DEFINITION (YAML) */}
      <div className="section">
        <div className="section-head">
          <div>
            <div className="section-title">Policy definition</div>
            <div className="secondary-text text-xs mt-0.5">
              Declarative security rules in YAML format.
            </div>
          </div>
          <div className="space-x-2">
            {isEditing ? (
              <>
                <button
                  onClick={() => {
                    setIsEditing(false)
                    if (policy?.rules_yaml) setYamlContent(policy.rules_yaml)
                  }}
                  className="btn btn-ghost btn-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={savePolicy}
                  disabled={saving}
                  className="btn btn-primary btn-sm"
                >
                  <Save className="h-3.5 w-3.5 mr-1" />
                  {saving ? "Saving..." : "Save Draft"}
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="btn btn-ghost btn-sm"
              >
                Edit YAML
              </button>
            )}
          </div>
        </div>

        {isEditing ? (
          <div className="panel p-0 overflow-hidden">
            <textarea
              value={yamlContent}
              onChange={(e) => setYamlContent(e.target.value)}
              className="w-full h-80 p-4 font-mono text-xs bg-slate-950 text-slate-100 border-0 focus:ring-0 focus:outline-none resize-y leading-relaxed"
              placeholder="Enter YAML policy configuration..."
            />
          </div>
        ) : (
          <div className="code-block font-mono text-xs rounded-xl overflow-hidden bg-slate-950 border border-slate-800 p-3 leading-relaxed">
            {yamlLines.map((line, idx) => {
              let formattedLine = line
              if (line.includes("#")) {
                formattedLine = `<span class="text-slate-500">${line}</span>`
              } else if (line.includes(":")) {
                const parts = line.split(":")
                const key = parts[0]
                const val = parts.slice(1).join(":")
                formattedLine = `<span class="text-teal-400 font-semibold">${key}</span>:<span class="text-slate-300">${val}</span>`
              }

              return (
                <div className="flex items-start space-x-3 py-0.5" key={idx}>
                  <span className="text-slate-600 select-none w-6 text-right text-[11px]">{idx + 1}</span>
                  <span className="text-slate-300 flex-1" dangerouslySetInnerHTML={{ __html: formattedLine }}></span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* VERSIONS */}
      <div className="section">
        <div className="section-head">
          <div>
            <div className="section-title">Version History</div>
            <div className="secondary-text text-xs mt-0.5">
              Complete immutable lineage of policy definitions with safe rollback support.
            </div>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: "12%" }}>Version</th>
                <th style={{ width: "16%" }}>Status</th>
                <th style={{ width: "38%" }}>Description</th>
                <th style={{ width: "16%" }}>Created</th>
                <th style={{ width: "18%", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => {
                const isActive = policy?.active_version_id === v.id
                return (
                  <tr key={v.id}>
                    <td data-label="Version" className="mono cell-primary font-semibold">
                      v{v.version_number}
                    </td>
                    <td data-label="Status">
                      {isActive ? (
                        <span className="badge badge-compliant"><span className="dot"></span>Active</span>
                      ) : (
                        <span className="badge badge-neutral">{v.status}</span>
                      )}
                    </td>
                    <td data-label="Description" className="secondary-text text-xs">
                      {v.status === "DRAFT" ? "Draft working copy" : `Published standard release v${v.version_number}`}
                    </td>
                    <td data-label="Created" className="muted text-xs">
                      {new Date(v.created_at).toLocaleDateString()}
                    </td>
                    <td data-label="Actions" style={{ textAlign: "right" }} className="space-x-1.5">
                      <button
                        onClick={() => inspectVersion(v.content || "")}
                        className="btn btn-ghost btn-sm text-xs"
                      >
                        Inspect
                      </button>
                      {v.status === "DRAFT" && (
                        <button
                          onClick={() => publishVersion(v.id)}
                          disabled={publishing === v.id}
                          className="btn btn-ghost btn-sm text-xs text-brand"
                        >
                          {publishing === v.id ? "Publishing..." : "Publish"}
                        </button>
                      )}
                      {v.status === "PUBLISHED" && !isActive && (
                        <button
                          onClick={() => setTargetRollbackVersion(v)}
                          className="btn btn-ghost btn-sm text-xs text-amber-400 hover:bg-amber-500/10"
                          title={`Roll back fleet standard to v${v.version_number}`}
                        >
                          <ArrowLeftRight className="h-3 w-3 inline mr-1" />
                          Rollback
                        </button>
                      )}
                    </td>
                  </tr>
                );
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
            All enrolled workstations in this organization are evaluated against the active policy.
          </div>
          <span className="badge badge-neutral text-xs">Default for fleet</span>
        </div>
      </div>

      {/* POLICY ROLLBACK CONFIRMATION MODAL */}
      {targetRollbackVersion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="panel max-w-lg w-full p-6 space-y-5 bg-[#0F172A] border border-amber-500/40 shadow-2xl rounded-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-2 text-amber-400">
              <History className="h-5 w-5" />
              <h3 className="text-base font-semibold text-text-primary">Confirm Safe Policy Rollback</h3>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-xs space-y-1.5">
              <div className="flex items-center space-x-1.5 font-semibold">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Fleet-Wide Policy Transition</span>
              </div>
              <p className="leading-relaxed">
                You are about to roll back the active standard from <b>Version {activeVersionNumber}</b> to <b>Version {targetRollbackVersion.version_number}</b>.
              </p>
            </div>

            <div className="text-xs text-text-muted space-y-2 bg-slate-900/80 p-3 rounded-lg border border-slate-800">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span>Current Active Standard:</span>
                <span className="font-semibold text-text-primary">v{activeVersionNumber}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span>Target Rollback Standard:</span>
                <span className="font-semibold text-amber-400">v{targetRollbackVersion.version_number}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Historical Version Immutability:</span>
                <span className="text-brand font-medium">Preserved (Zero Overwrites)</span>
              </div>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              Connected agents will automatically fetch Version {targetRollbackVersion.version_number} on their next check-in. An audit event and webhook alert will be recorded.
            </p>

            <div className="flex justify-end space-x-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setTargetRollbackVersion(null)}
                className="btn btn-ghost btn-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeRollback}
                disabled={rollingBack}
                className="btn btn-primary btn-sm bg-amber-600 hover:bg-amber-500 text-white border-none"
              >
                {rollingBack ? "Rolling back..." : `Roll back to v${targetRollbackVersion.version_number}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
