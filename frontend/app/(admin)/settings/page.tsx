"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Check, Copy, Trash2, Send, AlertTriangle, Key, ExternalLink,
  RefreshCw, Users, Shield, UserPlus, Building, Edit3, UserCheck,
  ShieldAlert, ShieldCheck, UserX, Info
} from "lucide-react"
import {
  PageHeader, LoadingState
} from "../../../components/ui"

interface OrgProfile {
  id: string
  name: string
  created_at: string
  updated_at?: string | null
  member_count: number
  device_count: number
  policy_count: number
  current_user_role?: string | null
}

interface OrgMember {
  id: string
  user_id: string
  email: string
  role: string
  created_at: string
}

interface EnrollmentToken {
  id: string
  organization_id: string
  token_hash: string
  created_by: string
  expires_at: string
  created_at: string
}

interface Webhook {
  id: string
  organization_id: string
  name: string
  endpoint_url: string
  enabled: boolean
  events: string[]
  created_at: string
  updated_at: string
  last_delivery_status?: string | null
  last_delivery_at?: string | null
}

export default function SettingsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"team" | "enrollment" | "webhooks">("team")
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("")

  // Org & Member States
  const [profile, setProfile] = useState<OrgProfile | null>(null)
  const [members, setMembers] = useState<OrgMember[]>([])
  const [profileName, setProfileName] = useState<string>("")
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)

  // Add Member Modal State
  const [showAddMember, setShowAddMember] = useState(false)
  const [addMemberEmail, setAddMemberEmail] = useState("")
  const [addMemberRole, setAddMemberRole] = useState<"admin" | "viewer">("viewer")
  const [addingMember, setAddingMember] = useState(false)
  const [addMemberError, setAddMemberError] = useState<string | null>(null)

  // Edit Role Modal State
  const [selectedMemberForRole, setSelectedMemberForRole] = useState<OrgMember | null>(null)
  const [editMemberRole, setEditMemberRole] = useState<"admin" | "viewer">("viewer")
  const [updatingRole, setUpdatingRole] = useState(false)
  const [editRoleError, setEditRoleError] = useState<string | null>(null)

  // Delete Member Modal State
  const [selectedMemberForDelete, setSelectedMemberForDelete] = useState<OrgMember | null>(null)
  const [deletingMember, setDeletingMember] = useState(false)
  const [deleteMemberError, setDeleteMemberError] = useState<string | null>(null)

  // Tokens & Webhooks States
  const [tokens, setTokens] = useState<EnrollmentToken[]>([])
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  // Webhook Modal States
  const [showAddWebhook, setShowAddWebhook] = useState(false)
  const [newHookName, setNewHookName] = useState("")
  const [newHookUrl, setNewHookUrl] = useState("")
  const [newHookEvents, setNewHookEvents] = useState<string[]>([
    "VIOLATION_TRIGGERED",
    "VIOLATION_RESOLVED",
    "POLICY_ROLLBACK"
  ])
  const [newHookEnabled, setNewHookEnabled] = useState(true)
  const [savingHook, setSavingHook] = useState(false)
  const [hookError, setHookError] = useState<string | null>(null)

  // One-time Reveal Secret Modal
  const [revealSecret, setRevealSecret] = useState<string | null>(null)
  const [revealHookName, setRevealHookName] = useState<string>("")

  // Webhook Test State
  const [testingHookId, setTestingHookId] = useState<string | null>(null)

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

  const isOwner = profile?.current_user_role?.toLowerCase() === "owner"

  const fetchSettingsData = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem("flientsec_token")
      if (!token) {
        setError("No active session. Redirecting...")
        router.push("/login")
        return
      }

      // Parse current user email from token payload
      try {
        const payloadBase64 = token.split(".")[1]
        const decodedJson = atob(payloadBase64)
        const payload = JSON.parse(decodedJson)
        if (payload?.sub) {
          setCurrentUserEmail(payload.sub)
        }
      } catch (e) {
        // Fallback silently if JWT parsing fails
      }

      // Fetch Org Profile
      const profRes = await fetch(`${apiUrl}/api/v1/org/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (profRes.ok) {
        const profData = await profRes.json()
        setProfile(profData)
        setProfileName(profData.name)
      } else if (profRes.status === 401) {
        localStorage.removeItem("flientsec_token")
        router.push("/login")
        return
      }

      // Fetch Members
      const membersRes = await fetch(`${apiUrl}/api/v1/org/members`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (membersRes.ok) {
        const membersData = await membersRes.json()
        setMembers(membersData.items || [])
      }

      // Fetch Enrollment Tokens
      const tokenRes = await fetch(`${apiUrl}/api/v1/enrollment-tokens`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (tokenRes.ok) {
        const tokenData = await tokenRes.json()
        setTokens(tokenData)
      }

      // Fetch Webhooks
      const hookRes = await fetch(`${apiUrl}/api/v1/webhooks`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (hookRes.ok) {
        const hookData = await hookRes.json()
        setWebhooks(hookData)
      }

      setError(null)
    } catch (err: any) {
      setError(err.message || "An error occurred while loading settings.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSettingsData()
  }, [apiUrl])

  // Save Org Profile Name
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profileName.trim()) return

    try {
      setSavingProfile(true)
      const token = localStorage.getItem("flientsec_token")
      const res = await fetch(`${apiUrl}/api/v1/org/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: profileName.trim() }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || "Failed to update organization name.")
      }

      const updated = await res.json()
      setProfile(updated)
      setProfileName(updated.name)
      setIsEditingProfile(false)
      showToast("Organization profile updated")
    } catch (err: any) {
      showToast(err.message || "Failed to update profile.")
    } finally {
      setSavingProfile(false)
    }
  }

  // Add Member
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddMemberError(null)
    setAddingMember(true)

    try {
      const token = localStorage.getItem("flientsec_token")
      const res = await fetch(`${apiUrl}/api/v1/org/members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: addMemberEmail.trim().toLowerCase(),
          role: addMemberRole,
        }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || "Failed to add member.")
      }

      const newMember = await res.json()
      setMembers((prev) => [...prev, newMember])
      if (profile) {
        setProfile({ ...profile, member_count: profile.member_count + 1 })
      }
      setShowAddMember(false)
      setAddMemberEmail("")
      setAddMemberRole("viewer")
      showToast(`Member added with ${newMember.role} role`)
    } catch (err: any) {
      setAddMemberError(err.message || "Failed to add member.")
    } finally {
      setAddingMember(false)
    }
  }

  // Update Member Role
  const handleUpdateMemberRole = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedMemberForRole) return
    setEditRoleError(null)
    setUpdatingRole(true)

    try {
      const token = localStorage.getItem("flientsec_token")
      const res = await fetch(`${apiUrl}/api/v1/org/members/${selectedMemberForRole.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: editMemberRole }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || "Failed to update member role.")
      }

      const updated = await res.json()
      setMembers((prev) =>
        prev.map((m) => (m.id === updated.id ? { ...m, role: updated.role } : m))
      )
      setSelectedMemberForRole(null)
      showToast(`Role updated to ${updated.role}`)
    } catch (err: any) {
      setEditRoleError(err.message || "Failed to update role.")
    } finally {
      setUpdatingRole(false)
    }
  }

  // Remove Member
  const handleRemoveMember = async () => {
    if (!selectedMemberForDelete) return
    setDeleteMemberError(null)
    setDeletingMember(true)

    try {
      const token = localStorage.getItem("flientsec_token")
      const res = await fetch(`${apiUrl}/api/v1/org/members/${selectedMemberForDelete.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || "Failed to remove member.")
      }

      setMembers((prev) => prev.filter((m) => m.id !== selectedMemberForDelete.id))
      if (profile) {
        setProfile({ ...profile, member_count: Math.max(1, profile.member_count - 1) })
      }
      setSelectedMemberForDelete(null)
      showToast("Member removed from workspace")
    } catch (err: any) {
      setDeleteMemberError(err.message || "Failed to remove member.")
    } finally {
      setDeletingMember(false)
    }
  }

  const handleGenerateToken = async () => {
    try {
      setGenerating(true)
      setError(null)

      const token = localStorage.getItem("flientsec_token")
      if (!token) throw new Error("Session expired. Please log in again.")

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
      showToast("Enrollment token generated")
    } catch (err: any) {
      setError(err.message || "Failed to generate enrollment token.")
    } finally {
      setGenerating(false)
    }
  }

  const handleRevokeToken = async (tokenId: string) => {
    if (!confirm("Are you sure you want to revoke this enrollment token? Any installer using it will fail to register new devices.")) {
      return
    }

    try {
      setError(null)
      const token = localStorage.getItem("flientsec_token")
      const res = await fetch(`${apiUrl}/api/v1/enrollment-tokens/${tokenId}/revoke`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      })

      if (!res.ok) throw new Error("Failed to revoke enrollment token.")

      setTokens((prev) => prev.filter((t) => t.id !== tokenId))
      showToast("Token revoked")
    } catch (err: any) {
      setError(err.message || "Failed to revoke enrollment token.")
    }
  }

  // Create Webhook
  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingHook(true)
    setHookError(null)

    try {
      const token = localStorage.getItem("flientsec_token")
      if (!token) throw new Error("Session expired. Please log in again.")

      if (!newHookName.trim() || !newHookUrl.trim()) {
        throw new Error("Webhook name and endpoint URL are required.")
      }

      const res = await fetch(`${apiUrl}/api/v1/webhooks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newHookName.trim(),
          endpoint_url: newHookUrl.trim(),
          events: newHookEvents,
          enabled: newHookEnabled
        })
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || "Failed to create webhook.")
      }

      const created = await res.json()
      setWebhooks((prev) => [created, ...prev])
      setShowAddWebhook(false)
      setNewHookName("")
      setNewHookUrl("")
      setNewHookEvents(["VIOLATION_TRIGGERED", "VIOLATION_RESOLVED", "POLICY_ROLLBACK"])

      // Open reveal modal
      setRevealHookName(created.name)
      setRevealSecret(created.signing_secret)
    } catch (err: any) {
      setHookError(err.message || "Failed to create webhook.")
    } finally {
      setSavingHook(false)
    }
  }

  // Toggle Webhook Enabled
  const handleToggleWebhook = async (hook: Webhook) => {
    try {
      const token = localStorage.getItem("flientsec_token")
      const updatedEnabled = !hook.enabled

      const res = await fetch(`${apiUrl}/api/v1/webhooks/${hook.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ enabled: updatedEnabled })
      })

      if (!res.ok) throw new Error("Failed to update webhook state.")

      setWebhooks((prev) =>
        prev.map((w) => (w.id === hook.id ? { ...w, enabled: updatedEnabled } : w))
      )
      showToast(updatedEnabled ? "Webhook enabled" : "Webhook disabled")
    } catch (err: any) {
      showToast(err.message || "Failed to update webhook.")
    }
  }

  // Test Webhook
  const handleTestWebhook = async (hookId: string) => {
    try {
      setTestingHookId(hookId)
      const token = localStorage.getItem("flientsec_token")

      const res = await fetch(`${apiUrl}/api/v1/webhooks/${hookId}/test`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || "Failed to trigger test delivery.")
      }

      const delivery = await res.json()
      if (delivery.status === "SUCCESS") {
        showToast(`Test delivery succeeded (HTTP ${delivery.response_status_code})`)
      } else {
        showToast(`Test delivery failed: ${delivery.error_message || `HTTP ${delivery.response_status_code}`}`)
      }
      fetchSettingsData()
    } catch (err: any) {
      showToast(err.message || "Test delivery failed.")
    } finally {
      setTestingHookId(null)
    }
  }

  // Delete Webhook
  const handleDeleteWebhook = async (hookId: string) => {
    if (!confirm("Are you sure you want to delete this webhook destination? This cannot be undone.")) {
      return
    }

    try {
      const token = localStorage.getItem("flientsec_token")
      const res = await fetch(`${apiUrl}/api/v1/webhooks/${hookId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      })

      if (!res.ok) throw new Error("Failed to delete webhook.")

      setWebhooks((prev) => prev.filter((w) => w.id !== hookId))
      showToast("Webhook deleted")
    } catch (err: any) {
      showToast(err.message || "Failed to delete webhook.")
    }
  }

  const copyToClipboard = (text: string, msg: string = "Copied to clipboard") => {
    navigator.clipboard.writeText(text)
    showToast(msg)
  }

  const showToast = (msg: string) => {
    setToastMsg(msg)
    const t = document.getElementById("toast")
    if (t) {
      t.classList.add("show")
      setTimeout(() => t.classList.remove("show"), 2200)
    }
  }

  const getRoleBadgeClass = (role: string) => {
    const r = role.toLowerCase()
    if (r === "owner") return "badge-compliant"
    if (r === "admin") return "badge-neutral text-teal-600 bg-teal-50 border-teal-200"
    return "badge-neutral"
  }

  if (loading) {
    return <LoadingState message="Retrieving organization settings..." />
  }

  return (
    <div className="space-y-8 flex-1 flex flex-col font-sans">
      {/* Page Header */}
      <PageHeader
        title="Settings & Workspace"
        subtitle="Manage team members, organization identity, workstation enrollment, and webhooks."
      />

      {error && (
        <div className="panel p-5 border border-danger/30 bg-danger/5 text-danger flex items-center justify-between text-sm font-medium">
          <span>{error}</span>
          <button onClick={fetchSettingsData} className="btn btn-sm">Retry</button>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="section">
        <div className="tabs">
          <div
            onClick={() => setActiveTab("team")}
            className={`tab ${activeTab === "team" ? "active" : ""}`}
          >
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span>Team & Organization ({members.length})</span>
            </div>
          </div>
          <div
            onClick={() => setActiveTab("enrollment")}
            className={`tab ${activeTab === "enrollment" ? "active" : ""}`}
          >
            <div className="flex items-center space-x-2">
              <Key className="h-4 w-4" />
              <span>Enrollment Tokens ({tokens.length})</span>
            </div>
          </div>
          <div
            onClick={() => setActiveTab("webhooks")}
            className={`tab ${activeTab === "webhooks" ? "active" : ""}`}
          >
            <div className="flex items-center space-x-2">
              <Shield className="h-4 w-4" />
              <span>Outbound Webhooks ({webhooks.length})</span>
            </div>
          </div>
        </div>

        {/* TAB 1: TEAM & ORGANIZATION */}
        {activeTab === "team" && (
          <div className="space-y-8 mt-6">
            {/* Organization Profile Panel */}
            <div className="panel p-6 bg-surface-1 border border-border rounded-xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-soft pb-5">
                <div className="flex items-center space-x-3.5">
                  <div className="w-12 h-12 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
                    <Building className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2.5">
                      <h2 className="text-lg font-semibold text-text-primary">
                        {profile?.name || "Workspace Organization"}
                      </h2>
                      <span className={`badge ${getRoleBadgeClass(profile?.current_user_role || "viewer")} text-[11px] uppercase tracking-wider`}>
                        {profile?.current_user_role || "viewer"}
                      </span>
                    </div>
                    <p className="text-xs text-text-muted mt-0.5">
                      Created {profile?.created_at ? new Date(profile.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : "Recently"}
                    </p>
                  </div>
                </div>

                {isOwner && !isEditingProfile && (
                  <button
                    onClick={() => setIsEditingProfile(true)}
                    className="btn btn-ghost btn-sm text-xs self-start sm:self-auto"
                  >
                    <Edit3 className="h-3.5 w-3.5 mr-1.5" />
                    Edit Profile Name
                  </button>
                )}
              </div>

              {isEditingProfile ? (
                <form onSubmit={handleSaveProfile} className="space-y-4 max-w-lg">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">
                      Organization Display Name
                    </label>
                    <input
                      type="text"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand"
                      required
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="submit"
                      disabled={savingProfile}
                      className="btn btn-primary btn-sm text-xs"
                    >
                      {savingProfile ? "Saving..." : "Save Changes"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileName(profile?.name || "")
                        setIsEditingProfile(false)
                      }}
                      className="btn btn-ghost btn-sm text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 bg-surface-2/60 border border-border-soft rounded-lg">
                    <div className="text-xs text-text-muted">Total Workspace Members</div>
                    <div className="text-xl font-bold text-text-primary mt-1">
                      {profile?.member_count || members.length}
                    </div>
                  </div>
                  <div className="p-4 bg-surface-2/60 border border-border-soft rounded-lg">
                    <div className="text-xs text-text-muted">Active Workstations</div>
                    <div className="text-xl font-bold text-text-primary mt-1">
                      {profile?.device_count ?? 0}
                    </div>
                  </div>
                  <div className="p-4 bg-surface-2/60 border border-border-soft rounded-lg">
                    <div className="text-xs text-text-muted">Configured Security Standards</div>
                    <div className="text-xl font-bold text-text-primary mt-1">
                      {profile?.policy_count ?? 0}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Team Directory Table */}
            <div className="section">
              <div className="section-head">
                <div>
                  <div className="section-title">Team Members Directory</div>
                  <div className="secondary-text text-xs mt-0.5">
                    Authorized security team personnel and system administrators.
                  </div>
                </div>
                {isOwner ? (
                  <button
                    onClick={() => {
                      setAddMemberError(null)
                      setShowAddMember(true)
                    }}
                    className="btn btn-primary btn-sm"
                  >
                    <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                    Add Member
                  </button>
                ) : (
                  <div className="text-xs text-text-muted italic flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5" />
                    <span>Member management is restricted to organization Owners</span>
                  </div>
                )}
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: "38%" }}>Member</th>
                      <th style={{ width: "20%" }}>Role</th>
                      <th style={{ width: "22%" }}>Joined Date</th>
                      <th style={{ width: "20%", textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => {
                      const isMe = currentUserEmail.toLowerCase() === m.email.toLowerCase()
                      const isTargetOwner = m.role.toLowerCase() === "owner"

                      return (
                        <tr key={m.id}>
                          <td data-label="Member">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 rounded-full bg-surface-2 border border-border flex items-center justify-center font-bold text-xs text-text-secondary uppercase">
                                {m.email.slice(0, 2)}
                              </div>
                              <div>
                                <div className="font-medium text-text-primary flex items-center gap-1.5">
                                  <span>{m.email}</span>
                                  {isMe && (
                                    <span className="badge badge-neutral text-[10px] px-1.5 py-0.2">
                                      You
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] font-mono text-text-muted">
                                  ID: {m.user_id.slice(0, 8)}...
                                </div>
                              </div>
                            </div>
                          </td>
                          <td data-label="Role">
                            <span className={`badge ${getRoleBadgeClass(m.role)} text-xs capitalize`}>
                              <span className="dot"></span>
                              {m.role}
                            </span>
                          </td>
                          <td data-label="Joined" className="muted text-xs">
                            {new Date(m.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                          </td>
                          <td data-label="Actions" style={{ textAlign: "right" }} className="space-x-1.5">
                            {isOwner && !isTargetOwner ? (
                              <>
                                <button
                                  onClick={() => {
                                    setSelectedMemberForRole(m)
                                    setEditMemberRole(m.role.toLowerCase() as "admin" | "viewer")
                                    setEditRoleError(null)
                                  }}
                                  className="btn btn-ghost btn-sm text-xs"
                                  title="Change member role"
                                >
                                  Change Role
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedMemberForDelete(m)
                                    setDeleteMemberError(null)
                                  }}
                                  className="btn btn-ghost btn-sm text-xs text-danger hover:bg-danger/10"
                                  title="Remove member from workspace"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </>
                            ) : (
                              <span className="text-xs text-text-muted">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ENROLLMENT TOKENS */}
        {activeTab === "enrollment" && (
          <div className="space-y-8 mt-6">
            <div className="section">
              <div className="section-head">
                <div>
                  <div className="section-title">Enrollment Tokens</div>
                  <div className="secondary-text text-xs mt-0.5">
                    Secure single-use tokens required to register new workstations with this organization.
                  </div>
                </div>
                <button
                  onClick={handleGenerateToken}
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
                    <thead>
                      <tr>
                        <th style={{ width: "35%" }}>Token Hash</th>
                        <th style={{ width: "25%" }}>Created</th>
                        <th style={{ width: "20%" }}>Expires</th>
                        <th style={{ width: "20%", textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tokens.map((t) => {
                        const isExpired = new Date(t.expires_at).getTime() < Date.now()
                        const displayHash = t.token_hash.slice(0, 16) + "..."
                        return (
                          <tr key={t.id}>
                            <td data-label="Token" className="cell-primary font-mono text-xs">
                              {displayHash}
                            </td>
                            <td data-label="Created" className="muted text-xs">
                              {new Date(t.created_at).toLocaleDateString()}
                            </td>
                            <td data-label="Expires">
                              {isExpired ? (
                                <span className="badge badge-neutral" style={{ color: "var(--danger)" }}>Expired</span>
                              ) : (
                                <span className="badge badge-neutral text-xs">
                                  {new Date(t.expires_at).toLocaleDateString()}
                                </span>
                              )}
                            </td>
                            <td data-label="Actions" style={{ textAlign: "right" }} className="space-x-2">
                              <button
                                onClick={() => copyToClipboard(t.token_hash, "Token copied")}
                                className="btn btn-ghost btn-sm text-xs"
                              >
                                Copy
                              </button>
                              <button
                                onClick={() => handleRevokeToken(t.id)}
                                className="btn btn-ghost btn-sm text-xs text-danger"
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

            {/* Installation Guide */}
            <div className="section">
              <div className="section-head">
                <div className="section-title">Install the agent</div>
              </div>
              <div className="panel">
                <div className="step">
                  <div className="step-num">1</div>
                  <div>
                    <div className="step-title">Generate an enrollment token</div>
                    <div className="step-body">Tokens expire after 7 days. Generate one above for each new workstation.</div>
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
          </div>
        )}

        {/* TAB 3: OUTBOUND WEBHOOKS */}
        {activeTab === "webhooks" && (
          <div className="space-y-8 mt-6">
            <div className="section">
              <div className="section-head">
                <div>
                  <div className="section-title">Outbound Webhooks</div>
                  <div className="secondary-text text-xs mt-0.5">
                    Send signed HMAC-SHA256 security alerts and policy rollback events to external SIEM/incident systems.
                  </div>
                </div>
                <button
                  onClick={() => {
                    setHookError(null)
                    setShowAddWebhook(true)
                  }}
                  className="btn btn-primary btn-sm"
                >
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" style={{ width: "14px", height: "14px", stroke: "currentColor" }}>
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                  Add Webhook
                </button>
              </div>

              <div className="table-wrap">
                {webhooks.length === 0 ? (
                  <div className="empty">
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" className="h-6 w-6 text-text-muted mb-3 mx-auto">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                    </svg>
                    <div className="empty-title">No webhooks configured</div>
                    <div className="empty-body">Add a webhook endpoint to receive real-time violation and rollback notifications.</div>
                  </div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: "22%" }}>Destination</th>
                        <th style={{ width: "32%" }}>Endpoint URL</th>
                        <th style={{ width: "22%" }}>Subscribed Events</th>
                        <th style={{ width: "10%" }}>Status</th>
                        <th style={{ width: "14%", textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {webhooks.map((w) => (
                        <tr key={w.id}>
                          <td data-label="Destination" className="cell-primary font-medium">
                            {w.name}
                          </td>
                          <td data-label="Endpoint" className="font-mono text-xs text-text-muted truncate max-w-xs">
                            {w.endpoint_url}
                          </td>
                          <td data-label="Events">
                            <div className="flex flex-wrap gap-1">
                              {w.events.map((ev) => (
                                <span key={ev} className="badge badge-neutral text-[10px] px-1.5 py-0.5">
                                  {ev === "VIOLATION_TRIGGERED"
                                    ? "Triggered"
                                    : ev === "VIOLATION_RESOLVED"
                                    ? "Resolved"
                                    : ev === "POLICY_ROLLBACK"
                                    ? "Rollback"
                                    : ev}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td data-label="Status">
                            <button
                              onClick={() => handleToggleWebhook(w)}
                              className={`badge cursor-pointer transition-colors ${w.enabled ? "badge-compliant" : "badge-neutral"}`}
                              title="Click to toggle status"
                            >
                              <span className="dot"></span>
                              {w.enabled ? "Active" : "Paused"}
                            </button>
                          </td>
                          <td data-label="Actions" style={{ textAlign: "right" }} className="space-x-1.5">
                            <button
                              onClick={() => handleTestWebhook(w.id)}
                              disabled={testingHookId === w.id}
                              className="btn btn-ghost btn-sm text-xs"
                              title="Dispatch signed test event"
                            >
                              {testingHookId === w.id ? (
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                "Test"
                              )}
                            </button>
                            <button
                              onClick={() => handleDeleteWebhook(w.id)}
                              className="btn btn-ghost btn-sm text-xs text-danger hover:bg-danger/10"
                              title="Delete webhook"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ADD MEMBER MODAL */}
      {showAddMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="panel max-w-md w-full p-6 space-y-5 bg-surface-1 border border-border shadow-2xl rounded-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border-soft pb-3">
              <div className="flex items-center space-x-2.5">
                <UserPlus className="h-5 w-5 text-brand" />
                <h3 className="text-base font-semibold text-text-primary">Add Workspace Member</h3>
              </div>
              <button
                onClick={() => setShowAddMember(false)}
                className="text-text-muted hover:text-text-primary text-sm p-1"
              >
                ✕
              </button>
            </div>

            {addMemberError && (
              <div className="p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-xs flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{addMemberError}</span>
              </div>
            )}

            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  Member Email Address
                </label>
                <input
                  type="email"
                  placeholder="analyst@organization.com"
                  value={addMemberEmail}
                  onChange={(e) => setAddMemberEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  Assigned Permission Role
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => setAddMemberRole("viewer")}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      addMemberRole === "viewer"
                        ? "border-brand bg-brand/5"
                        : "border-border bg-surface-2 hover:border-border-hover"
                    }`}
                  >
                    <div className="font-semibold text-xs text-text-primary flex items-center justify-between">
                      <span>Viewer</span>
                      {addMemberRole === "viewer" && <Check className="h-3.5 w-3.5 text-brand" />}
                    </div>
                    <p className="text-[11px] text-text-muted mt-1 leading-relaxed">
                      Read-only access across fleet posture, evidence, and compliance reports.
                    </p>
                  </div>

                  <div
                    onClick={() => setAddMemberRole("admin")}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      addMemberRole === "admin"
                        ? "border-brand bg-brand/5"
                        : "border-border bg-surface-2 hover:border-border-hover"
                    }`}
                  >
                    <div className="font-semibold text-xs text-text-primary flex items-center justify-between">
                      <span>Admin</span>
                      {addMemberRole === "admin" && <Check className="h-3.5 w-3.5 text-brand" />}
                    </div>
                    <p className="text-[11px] text-text-muted mt-1 leading-relaxed">
                      Manage security standards, remediate findings, and configure webhooks.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-surface-2 border border-border-soft rounded-lg text-[11px] text-text-muted flex items-start space-x-2">
                <Info className="h-4 w-4 shrink-0 mt-0.5 text-brand" />
                <span>
                  FlientSec provisions workspace access immediately without external SMTP dependencies.
                </span>
              </div>

              <div className="flex justify-end space-x-2.5 pt-3 border-t border-border-soft">
                <button
                  type="button"
                  onClick={() => setShowAddMember(false)}
                  className="btn btn-ghost btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingMember}
                  className="btn btn-primary btn-sm"
                >
                  {addingMember ? "Adding..." : "Add Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT ROLE MODAL */}
      {selectedMemberForRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="panel max-w-md w-full p-6 space-y-5 bg-surface-1 border border-border shadow-2xl rounded-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border-soft pb-3">
              <div className="flex items-center space-x-2.5">
                <ShieldCheck className="h-5 w-5 text-brand" />
                <h3 className="text-base font-semibold text-text-primary">Change Member Role</h3>
              </div>
              <button
                onClick={() => setSelectedMemberForRole(null)}
                className="text-text-muted hover:text-text-primary text-sm p-1"
              >
                ✕
              </button>
            </div>

            {editRoleError && (
              <div className="p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-xs flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{editRoleError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateMemberRole} className="space-y-4">
              <div>
                <div className="text-xs text-text-muted mb-1">Target Member:</div>
                <div className="font-medium text-sm text-text-primary">
                  {selectedMemberForRole.email}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  Select New Role
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => setEditMemberRole("viewer")}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      editMemberRole === "viewer"
                        ? "border-brand bg-brand/5"
                        : "border-border bg-surface-2 hover:border-border-hover"
                    }`}
                  >
                    <div className="font-semibold text-xs text-text-primary flex items-center justify-between">
                      <span>Viewer</span>
                      {editMemberRole === "viewer" && <Check className="h-3.5 w-3.5 text-brand" />}
                    </div>
                    <p className="text-[11px] text-text-muted mt-1 leading-relaxed">
                      Read-only posture access.
                    </p>
                  </div>

                  <div
                    onClick={() => setEditMemberRole("admin")}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      editMemberRole === "admin"
                        ? "border-brand bg-brand/5"
                        : "border-border bg-surface-2 hover:border-border-hover"
                    }`}
                  >
                    <div className="font-semibold text-xs text-text-primary flex items-center justify-between">
                      <span>Admin</span>
                      {editMemberRole === "admin" && <Check className="h-3.5 w-3.5 text-brand" />}
                    </div>
                    <p className="text-[11px] text-text-muted mt-1 leading-relaxed">
                      Full mutation permissions.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2.5 pt-3 border-t border-border-soft">
                <button
                  type="button"
                  onClick={() => setSelectedMemberForRole(null)}
                  className="btn btn-ghost btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingRole}
                  className="btn btn-primary btn-sm"
                >
                  {updatingRole ? "Saving..." : "Update Role"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE MEMBER MODAL */}
      {selectedMemberForDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="panel max-w-md w-full p-6 space-y-4 bg-surface-1 border border-danger/30 shadow-2xl rounded-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-2 text-danger">
              <UserX className="h-5 w-5" />
              <h3 className="text-base font-semibold text-text-primary">Remove Member</h3>
            </div>

            {deleteMemberError && (
              <div className="p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-xs flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{deleteMemberError}</span>
              </div>
            )}

            <p className="text-xs text-text-secondary leading-relaxed">
              Are you sure you want to remove <b>{selectedMemberForDelete.email}</b> from this workspace? They will immediately lose access to this organization.
            </p>

            <div className="p-3 bg-surface-2 border border-border-soft rounded-lg text-[11px] text-text-muted">
              Note: The underlying user account is preserved and can access other organizations they belong to.
            </div>

            <div className="flex justify-end space-x-2.5 pt-2 border-t border-border-soft">
              <button
                type="button"
                onClick={() => setSelectedMemberForDelete(null)}
                className="btn btn-ghost btn-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRemoveMember}
                disabled={deletingMember}
                className="btn btn-sm bg-danger text-white hover:bg-danger/90"
              >
                {deletingMember ? "Removing..." : "Remove Member"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE WEBHOOK MODAL */}
      {showAddWebhook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="panel max-w-lg w-full p-6 space-y-5 bg-surface-1 border border-border shadow-2xl rounded-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border-soft pb-3">
              <div>
                <h3 className="text-base font-semibold text-text-primary">Add Outbound Webhook</h3>
                <p className="text-xs text-text-muted mt-0.5">Receive signed security events in real time.</p>
              </div>
              <button
                onClick={() => setShowAddWebhook(false)}
                className="text-text-muted hover:text-text-primary text-sm p-1"
              >
                ✕
              </button>
            </div>

            {hookError && (
              <div className="p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-xs flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{hookError}</span>
              </div>
            )}

            <form onSubmit={handleCreateWebhook} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  Webhook Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Splunk SIEM Alerting"
                  value={newHookName}
                  onChange={(e) => setNewHookName(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  Endpoint URL
                </label>
                <input
                  type="url"
                  placeholder="https://siem.corp.internal/flientsec-webhook"
                  value={newHookUrl}
                  onChange={(e) => setNewHookUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-sm font-mono text-text-primary focus:outline-none focus:border-brand"
                  required
                />
                <p className="text-[11px] text-text-muted mt-1">
                  Must be HTTP or HTTPS. Localhost and private RFC1918 ranges are disallowed.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-2">
                  Event Subscriptions
                </label>
                <div className="space-y-2 text-xs">
                  {[
                    { id: "VIOLATION_TRIGGERED", label: "VIOLATION_TRIGGERED", desc: "Workstation rule non-compliance detected" },
                    { id: "VIOLATION_RESOLVED", label: "VIOLATION_RESOLVED", desc: "Workstation rule remediated or removed" },
                    { id: "POLICY_ROLLBACK", label: "POLICY_ROLLBACK", desc: "Active fleet security standard rolled back" }
                  ].map((item) => (
                    <label key={item.id} className="flex items-start space-x-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newHookEvents.includes(item.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewHookEvents([...newHookEvents, item.id])
                          } else {
                            setNewHookEvents(newHookEvents.filter((ev) => ev !== item.id))
                          }
                        }}
                        className="mt-0.5 rounded border-border bg-surface-2 text-brand focus:ring-0"
                      />
                      <div>
                        <div className="font-mono text-text-primary font-medium">{item.label}</div>
                        <div className="text-text-muted text-[11px]">{item.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="hookEnabled"
                  checked={newHookEnabled}
                  onChange={(e) => setNewHookEnabled(e.target.checked)}
                  className="rounded border-border bg-surface-2 text-brand focus:ring-0"
                />
                <label htmlFor="hookEnabled" className="text-xs text-text-secondary cursor-pointer">
                  Enable immediately upon creation
                </label>
              </div>

              <div className="flex justify-end space-x-2.5 pt-3 border-t border-border-soft">
                <button
                  type="button"
                  onClick={() => setShowAddWebhook(false)}
                  className="btn btn-ghost btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingHook}
                  className="btn btn-primary btn-sm"
                >
                  {savingHook ? "Saving..." : "Create Webhook"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REVEAL-ONCE SIGNING SECRET MODAL */}
      {revealSecret && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="panel max-w-lg w-full p-6 space-y-4 bg-surface-1 border border-brand/40 shadow-2xl rounded-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-2 text-brand">
              <Key className="h-5 w-5" />
              <h3 className="text-base font-semibold text-text-primary">Webhook Signing Secret</h3>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-xs flex items-start space-x-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                <b>Important:</b> This signing secret will <b>NEVER</b> be shown again. Copy it now and configure your receiver to verify the <code>X-FlientSec-Signature</code> header.
              </span>
            </div>

            <div>
              <div className="text-xs text-text-muted mb-1">Secret for <b>{revealHookName}</b>:</div>
              <div className="flex items-center justify-between p-3 bg-surface-2 border border-border rounded-lg font-mono text-xs text-brand break-all select-all">
                <span>{revealSecret}</span>
                <button
                  onClick={() => copyToClipboard(revealSecret, "Secret copied to clipboard")}
                  className="btn btn-ghost btn-sm shrink-0 ml-2"
                  title="Copy secret"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setRevealSecret(null)}
                className="btn btn-primary btn-sm w-full sm:w-auto"
              >
                I have stored this secret safely
              </button>
            </div>
          </div>
        </div>
      )}

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
