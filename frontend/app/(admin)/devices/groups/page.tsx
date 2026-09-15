"use client"

import React, { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Search, RotateCw, Plus, FolderKanban, ShieldCheck,
  Laptop, Trash2, Edit3, ShieldAlert,
  ArrowRight, X, AlertTriangle, Link as LinkIcon, Unlink
} from "lucide-react"
import {
  PageHeader, LoadingState, EmptyState, StatusBadge
} from "../../../../components/ui"

interface DeviceGroup {
  id: string
  organization_id: string
  name: string
  description: string | null
  policy_id: string | null
  policy_name: string | null
  policy_version_number: number | null
  device_count: number
  compliant_count: number
  created_at: string
  updated_at: string
}

interface GroupDevice {
  id: string
  hostname: string
  os_name: string
  os_version: string
  status: string
  compliance_status: string
  compliance_score: number
  group_id: string | null
  group_name: string | null
  effective_policy_source: string | null
  effective_policy_name: string | null
}

interface PolicyOption {
  id: string
  name: string
  active_version_number: number | null
}

export default function DeviceGroupsPage() {
  const router = useRouter()
  const [groups, setGroups] = useState<DeviceGroup[]>([])
  const [allDevices, setAllDevices] = useState<GroupDevice[]>([])
  const [policies, setPolicies] = useState<PolicyOption[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string>("viewer")

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>("")

  // Drawer / Modal States
  const [selectedGroup, setSelectedGroup] = useState<DeviceGroup | null>(null)
  const [groupDevices, setGroupDevices] = useState<GroupDevice[]>([])
  const [drawerLoading, setDrawerLoading] = useState<boolean>(false)

  // Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false)
  const [createName, setCreateName] = useState<string>("")
  const [createDesc, setCreateDesc] = useState<string>("")
  const [createError, setCreateError] = useState<string | null>(null)
  const [submittingCreate, setSubmittingCreate] = useState<boolean>(false)

  // Edit Modal
  const [editingGroup, setEditingGroup] = useState<DeviceGroup | null>(null)
  const [editName, setEditName] = useState<string>("")
  const [editDesc, setEditDesc] = useState<string>("")
  const [editError, setEditError] = useState<string | null>(null)
  const [submittingEdit, setSubmittingEdit] = useState<boolean>(false)

  // Delete Modal
  const [deletingGroup, setDeletingGroup] = useState<DeviceGroup | null>(null)
  const [submittingDelete, setSubmittingDelete] = useState<boolean>(false)

  // Assign Policy Modal
  const [policyGroup, setPolicyGroup] = useState<DeviceGroup | null>(null)
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>("")
  const [submittingPolicy, setSubmittingPolicy] = useState<boolean>(false)
  const [policyError, setPolicyError] = useState<string | null>(null)

  // Add Device to Group Modal/State inside Drawer
  const [selectedDeviceToAdd, setSelectedDeviceToAdd] = useState<string>("")
  const [addingDevice, setAddingDevice] = useState<boolean>(false)

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

  const fetchData = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem("flientsec_token")
      if (!token) {
        router.push("/login")
        return
      }
      const headers = { Authorization: `Bearer ${token}` }

      // 1. Fetch user role from org profile
      try {
        const orgRes = await fetch(`${apiUrl}/api/v1/organizations/profile`, { headers })
        if (orgRes.ok) {
          const orgData = await orgRes.json()
          if (orgData.user_role) {
            setUserRole(orgData.user_role.toLowerCase())
          }
        }
      } catch {
        // Default to viewer if profile read fails
      }

      // 2. Fetch Device Groups
      const groupsRes = await fetch(`${apiUrl}/api/v1/device-groups`, { headers })
      if (!groupsRes.ok) {
        if (groupsRes.status === 401) {
          localStorage.removeItem("flientsec_token")
          router.push("/login")
          return
        }
        throw new Error("Failed to load device groups from server.")
      }
      const groupsData = await groupsRes.json()
      setGroups(groupsData)

      // 3. Fetch All Devices (for counts and add-member selector)
      const devicesRes = await fetch(`${apiUrl}/api/v1/devices`, { headers })
      if (devicesRes.ok) {
        const devicesData = await devicesRes.json()
        setAllDevices(devicesData)
      }

      // 4. Fetch Available Policies
      const policiesRes = await fetch(`${apiUrl}/api/v1/policies-list`, { headers })
      if (policiesRes.ok) {
        const policiesData = await policiesRes.json()
        setPolicies(policiesData)
      }

      setError(null)
    } catch (err: any) {
      setError(err.message || "Failed to establish database connection.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Open Drawer and fetch group member devices
  const handleOpenGroupDrawer = async (group: DeviceGroup) => {
    setSelectedGroup(group)
    try {
      setDrawerLoading(true)
      const token = localStorage.getItem("flientsec_token")
      const headers = { Authorization: `Bearer ${token}` }
      const res = await fetch(`${apiUrl}/api/v1/device-groups/${group.id}/devices`, { headers })
      if (res.ok) {
        const data = await res.json()
        setGroupDevices(data)
      }
    } catch {
      // ignore
    } finally {
      setDrawerLoading(false)
    }
  }

  // Create Group Handler
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createName.trim()) return
    try {
      setSubmittingCreate(true)
      setCreateError(null)
      const token = localStorage.getItem("flientsec_token")
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      }
      const res = await fetch(`${apiUrl}/api/v1/device-groups`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: createName.trim(),
          description: createDesc.trim() || null,
        }),
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || "Failed to create device group.")
      }
      setIsCreateOpen(false)
      setCreateName("")
      setCreateDesc("")
      await fetchData()
    } catch (err: any) {
      setCreateError(err.message)
    } finally {
      setSubmittingCreate(false)
    }
  }

  // Edit Group Handler
  const handleEditGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingGroup || !editName.trim()) return
    try {
      setSubmittingEdit(true)
      setEditError(null)
      const token = localStorage.getItem("flientsec_token")
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      }
      const res = await fetch(`${apiUrl}/api/v1/device-groups/${editingGroup.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          name: editName.trim(),
          description: editDesc.trim() || null,
        }),
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || "Failed to update device group.")
      }
      setEditingGroup(null)
      await fetchData()
    } catch (err: any) {
      setEditError(err.message)
    } finally {
      setSubmittingEdit(false)
    }
  }

  // Delete Group Handler
  const handleDeleteGroup = async () => {
    if (!deletingGroup) return
    try {
      setSubmittingDelete(true)
      const token = localStorage.getItem("flientsec_token")
      const headers = { Authorization: `Bearer ${token}` }
      const res = await fetch(`${apiUrl}/api/v1/device-groups/${deletingGroup.id}`, {
        method: "DELETE",
        headers,
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || "Failed to delete device group.")
      }
      setDeletingGroup(null)
      if (selectedGroup?.id === deletingGroup.id) {
        setSelectedGroup(null)
      }
      await fetchData()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSubmittingDelete(false)
    }
  }

  // Assign/Unassign Policy Handler
  const handleAssignPolicy = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!policyGroup) return
    try {
      setSubmittingPolicy(true)
      setPolicyError(null)
      const token = localStorage.getItem("flientsec_token")
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      }

      if (!selectedPolicyId) {
        // Unassign policy
        const res = await fetch(`${apiUrl}/api/v1/device-groups/${policyGroup.id}/policy`, {
          method: "DELETE",
          headers,
        })
        if (!res.ok) {
          const errData = await res.json()
          throw new Error(errData.detail || "Failed to unassign policy.")
        }
      } else {
        // Assign policy
        const res = await fetch(`${apiUrl}/api/v1/device-groups/${policyGroup.id}/policy`, {
          method: "POST",
          headers,
          body: JSON.stringify({ policy_id: selectedPolicyId }),
        })
        if (!res.ok) {
          const errData = await res.json()
          throw new Error(errData.detail || "Failed to assign policy to group.")
        }
      }

      setPolicyGroup(null)
      await fetchData()
    } catch (err: any) {
      setPolicyError(err.message)
    } finally {
      setSubmittingPolicy(false)
    }
  }

  // Add Device to Group Handler
  const handleAddDeviceToGroup = async () => {
    if (!selectedGroup || !selectedDeviceToAdd) return
    try {
      setAddingDevice(true)
      const token = localStorage.getItem("flientsec_token")
      const headers = { Authorization: `Bearer ${token}` }
      const res = await fetch(
        `${apiUrl}/api/v1/device-groups/${selectedGroup.id}/devices/${selectedDeviceToAdd}`,
        { method: "POST", headers }
      )
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || "Failed to add workstation to group.")
      }
      setSelectedDeviceToAdd("")
      // Refresh drawer member list and main data
      const refreshRes = await fetch(`${apiUrl}/api/v1/device-groups/${selectedGroup.id}/devices`, { headers })
      if (refreshRes.ok) {
        const data = await refreshRes.json()
        setGroupDevices(data)
      }
      await fetchData()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setAddingDevice(false)
    }
  }

  // Remove Device from Group Handler
  const handleRemoveDeviceFromGroup = async (deviceId: string) => {
    if (!selectedGroup) return
    try {
      const token = localStorage.getItem("flientsec_token")
      const headers = { Authorization: `Bearer ${token}` }
      const res = await fetch(
        `${apiUrl}/api/v1/device-groups/${selectedGroup.id}/devices/${deviceId}`,
        { method: "DELETE", headers }
      )
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || "Failed to remove workstation from group.")
      }
      // Refresh drawer member list and main data
      setGroupDevices(prev => prev.filter(d => d.id !== deviceId))
      await fetchData()
    } catch (err: any) {
      alert(err.message)
    }
  }

  // Filtered Groups
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups
    const q = searchQuery.toLowerCase()
    return groups.filter(g =>
      g.name.toLowerCase().includes(q) ||
      (g.description && g.description.toLowerCase().includes(q)) ||
      (g.policy_name && g.policy_name.toLowerCase().includes(q))
    )
  }, [groups, searchQuery])

  // Overview Metrics
  const totalGroupedCount = useMemo(() => {
    return groups.reduce((acc, g) => acc + g.device_count, 0)
  }, [groups])

  const ungroupedCount = useMemo(() => {
    return allDevices.filter(d => !d.group_id).length
  }, [allDevices])

  // Candidate devices available to add into selected group
  const candidateDevicesToAdd = useMemo(() => {
    if (!selectedGroup) return []
    return allDevices.filter(
      d => d.group_id !== selectedGroup.id && d.status !== "DECOMMISSIONED"
    )
  }, [allDevices, selectedGroup])

  const canManage = userRole === "owner" || userRole === "admin"

  if (loading) {
    return <LoadingState message="Retrieving fleet device groups..." />
  }

  return (
    <div className="space-y-8 flex-1 flex flex-col font-sans">
      {/* Page Header */}
      <PageHeader
        title="Devices"
        subtitle={`Device grouping · Organize workstations into functional fleets with dedicated security policies.`}
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              className="btn btn-sm"
              aria-label="Refresh group list"
              title="Refresh group list"
            >
              <RotateCw className="h-4 w-4" />
              <span>Refresh</span>
            </button>
            {canManage && (
              <button
                onClick={() => {
                  setCreateName("")
                  setCreateDesc("")
                  setCreateError(null)
                  setIsCreateOpen(true)
                }}
                className="btn btn-sm btn-primary"
              >
                <Plus className="h-4 w-4" />
                <span>Create Group</span>
              </button>
            )}
          </div>
        }
      />

      {/* Sub-Navigation Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex space-x-6 text-sm">
          <Link
            href="/devices"
            className="pb-3 text-text-muted hover:text-text-main font-medium border-b-2 border-transparent"
          >
            Enrolled Workstations ({allDevices.length})
          </Link>
          <div className="pb-3 text-brand font-semibold border-b-2 border-brand flex items-center gap-2">
            <FolderKanban className="h-4 w-4" />
            <span>Device Groups ({groups.length})</span>
          </div>
        </div>
      </div>

      {/* API Error Warning */}
      {error && (
        <div className="panel p-5 border border-danger/30 bg-danger/5 text-danger text-sm flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <ShieldAlert className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={fetchData} className="btn btn-sm">
            Retry Connection
          </button>
        </div>
      )}

      {/* Fleet Grouping Metrics Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="panel p-5">
          <div className="section-hint">Total Groups</div>
          <div className="stat-value mt-1 text-2xl font-bold">{groups.length}</div>
          <div className="text-xs text-text-muted mt-1">Configured fleet segments</div>
        </div>
        <div className="panel p-5">
          <div className="section-hint">Grouped Workstations</div>
          <div className="stat-value mt-1 text-2xl font-bold text-brand">{totalGroupedCount}</div>
          <div className="text-xs text-text-muted mt-1">Bound to group governance</div>
        </div>
        <div className="panel p-5">
          <div className="section-hint">Ungrouped Workstations</div>
          <div className="stat-value mt-1 text-2xl font-bold text-text-muted">{ungroupedCount}</div>
          <div className="text-xs text-text-muted mt-1">Inheriting organization default</div>
        </div>
        <div className="panel p-5">
          <div className="section-hint">Policies Assigned</div>
          <div className="stat-value mt-1 text-2xl font-bold text-teal-700">
            {groups.filter(g => g.policy_id).length}
          </div>
          <div className="text-xs text-text-muted mt-1">Active group-level policies</div>
        </div>
      </div>

      {/* Toolbar: Search and Filter */}
      <div className="section" style={{ marginBottom: "16px" }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="input-wrap max-w-sm w-full">
            <Search className="h-4.5 w-4.5 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search groups, descriptions, policies…"
              className="input"
            />
          </div>
          <div className="text-xs text-text-muted">
            Showing <b>{filteredGroups.length}</b> of <b>{groups.length}</b> groups
          </div>
        </div>
      </div>

      {/* Groups Listing */}
      {filteredGroups.length === 0 ? (
        <div className="py-8 text-center space-y-4">
          <EmptyState
            title={searchQuery ? "No matching device groups" : "No device groups created yet"}
            description={
              searchQuery
                ? "Try clearing your search query to see all groups."
                : "Organize your workstations into groups (e.g. Engineering, Finance, PCI DSS) to apply specialized security policies."
            }
            icon={FolderKanban}
          />
          {canManage && !searchQuery && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="btn btn-sm btn-primary inline-flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" />
              <span>Create First Group</span>
            </button>
          )}
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Group Name & Description</th>
                <th>Workstations</th>
                <th>Assigned Policy</th>
                <th>Compliance</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredGroups.map((group) => {
                const compliancePercent =
                  group.device_count > 0
                    ? Math.round((group.compliant_count / group.device_count) * 100)
                    : null

                return (
                  <tr key={group.id} className="hover:bg-slate-50/60">
                    <td data-label="Group Name">
                      <div className="font-semibold text-text-main flex items-center gap-2">
                        <FolderKanban className="h-4 w-4 text-brand flex-shrink-0" />
                        <span>{group.name}</span>
                      </div>
                      {group.description && (
                        <div className="text-xs text-text-muted mt-0.5 max-w-md line-clamp-1">
                          {group.description}
                        </div>
                      )}
                    </td>

                    <td data-label="Workstations">
                      <button
                        onClick={() => handleOpenGroupDrawer(group)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 hover:bg-slate-200 text-text-main transition-colors"
                      >
                        <Laptop className="h-3.5 w-3.5 text-text-muted" />
                        <span>{group.device_count} {group.device_count === 1 ? "workstation" : "workstations"}</span>
                        <ArrowRight className="h-3 w-3 text-text-muted" />
                      </button>
                    </td>

                    <td data-label="Assigned Policy">
                      {group.policy_id ? (
                        <div className="inline-flex items-center gap-1.5 text-xs">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-medium bg-teal-50 text-teal-800 border border-teal-200">
                            <ShieldCheck className="h-3.5 w-3.5 text-teal-600" />
                            <span>{group.policy_name || "Assigned Policy"}</span>
                            {group.policy_version_number && (
                              <span className="mono text-[10px] text-teal-600">v{group.policy_version_number}</span>
                            )}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-text-muted italic flex items-center gap-1">
                          <Unlink className="h-3 w-3 text-slate-400" />
                          Org Default (None)
                        </span>
                      )}
                    </td>

                    <td data-label="Compliance">
                      {group.device_count > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-slate-200 rounded-full h-2 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${compliancePercent}%`,
                                backgroundColor:
                                  (compliancePercent || 0) >= 90
                                    ? "var(--brand)"
                                    : (compliancePercent || 0) >= 70
                                    ? "var(--warning)"
                                    : "var(--danger)",
                              }}
                            />
                          </div>
                          <span className="text-xs font-mono font-medium">
                            {group.compliant_count}/{group.device_count} ({compliancePercent}%)
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-text-muted">—</span>
                      )}
                    </td>

                    <td data-label="Actions" style={{ textAlign: "right" }}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenGroupDrawer(group)}
                          className="btn btn-sm btn-ghost"
                          title="Manage member workstations"
                        >
                          <Laptop className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Members</span>
                        </button>

                        {canManage && (
                          <>
                            <button
                              onClick={() => {
                                setPolicyGroup(group)
                                setSelectedPolicyId(group.policy_id || "")
                                setPolicyError(null)
                              }}
                              className="btn btn-sm btn-ghost"
                              title="Assign group security policy"
                            >
                              <LinkIcon className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Policy</span>
                            </button>

                            <button
                              onClick={() => {
                                setEditingGroup(group)
                                setEditName(group.name)
                                setEditDesc(group.description || "")
                                setEditError(null)
                              }}
                              className="btn btn-sm btn-ghost text-text-muted hover:text-text-main"
                              title="Edit group details"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>

                            <button
                              onClick={() => setDeletingGroup(group)}
                              className="btn btn-sm btn-ghost text-danger hover:bg-danger/10"
                              title="Delete group"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DRAWER: Group Member Workstations Management */}
      {/* ========================================================================= */}
      {selectedGroup && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-black/40 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col transform transition-transform animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-6 border-b border-slate-200 flex items-start justify-between bg-slate-50/50">
              <div>
                <div className="flex items-center gap-2">
                  <FolderKanban className="h-5 w-5 text-brand" />
                  <h2 className="text-lg font-bold text-text-main">{selectedGroup.name}</h2>
                </div>
                <div className="text-xs text-text-muted mt-1">
                  {selectedGroup.description || "No description provided."}
                </div>
                <div className="flex items-center gap-3 mt-3 text-xs">
                  <span className="font-medium text-slate-700">
                    Policy:{" "}
                    <b className="text-brand">
                      {selectedGroup.policy_name || "Org Default"}
                    </b>
                  </span>
                  <span>•</span>
                  <span>
                    <b>{groupDevices.length}</b> enrolled {groupDevices.length === 1 ? "workstation" : "workstations"}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedGroup(null)}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-slate-200/60"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Add Device Section */}
              {canManage && (
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
                  <div className="text-xs font-semibold text-text-main uppercase tracking-wider">
                    Add Workstation to Group
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={selectedDeviceToAdd}
                      onChange={(e) => setSelectedDeviceToAdd(e.target.value)}
                      className="select text-xs flex-1"
                      disabled={addingDevice || candidateDevicesToAdd.length === 0}
                    >
                      <option value="">
                        {candidateDevicesToAdd.length === 0
                          ? "No available workstations to add"
                          : "Select a workstation…"}
                      </option>
                      {candidateDevicesToAdd.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.hostname} ({d.os_name}) {d.group_name ? `[Current: ${d.group_name}]` : "[Ungrouped]"}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleAddDeviceToGroup}
                      disabled={!selectedDeviceToAdd || addingDevice}
                      className="btn btn-sm btn-primary whitespace-nowrap"
                    >
                      {addingDevice ? "Adding…" : "Add Device"}
                    </button>
                  </div>
                  <div className="text-[11px] text-text-muted">
                    Workstations moved from another group will immediately receive this group's active policy.
                  </div>
                </div>
              )}

              {/* Members List */}
              <div className="space-y-3">
                <div className="text-xs font-semibold text-text-main uppercase tracking-wider">
                  Member Workstations ({groupDevices.length})
                </div>

                {drawerLoading ? (
                  <div className="py-8 text-center text-xs text-text-muted">
                    Loading member workstations…
                  </div>
                ) : groupDevices.length === 0 ? (
                  <div className="py-8 border border-dashed border-slate-200 rounded-xl text-center text-xs text-text-muted">
                    No workstations currently assigned to this group.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {groupDevices.map((device) => (
                      <div
                        key={device.id}
                        className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/devices/${device.id}`}
                              className="font-medium text-sm text-text-main hover:text-brand hover:underline"
                            >
                              {device.hostname}
                            </Link>
                            <StatusBadge status={device.compliance_status} />
                          </div>
                          <div className="text-xs text-text-muted mono">
                            {device.os_name} {device.os_version} • Score: {device.compliance_score}/100
                          </div>
                          {device.effective_policy_source === "DEVICE_OVERRIDE" && (
                            <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded inline-block font-medium">
                              Direct Device Override Active
                            </div>
                          )}
                        </div>

                        {canManage && (
                          <button
                            onClick={() => handleRemoveDeviceFromGroup(device.id)}
                            className="btn btn-sm btn-ghost text-danger hover:bg-danger/10"
                            title="Remove workstation from group"
                          >
                            <Unlink className="h-3.5 w-3.5 mr-1" />
                            <span>Remove</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setSelectedGroup(null)}
                className="btn btn-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Create Group */}
      {/* ========================================================================= */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <FolderKanban className="h-5 w-5 text-brand" />
                <h3 className="font-bold text-text-main text-base">Create Device Group</h3>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-text-muted hover:text-text-main"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="p-5 space-y-4">
              {createError && (
                <div className="p-3 bg-danger/10 border border-danger/20 text-danger text-xs rounded-lg flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-text-main mb-1">
                  Group Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Engineering Fleet, Finance Laptops"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className="input w-full text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-main mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe the purpose or workstation cohort for this group…"
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  className="input w-full text-sm"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="btn btn-sm"
                  disabled={submittingCreate}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCreate || !createName.trim()}
                  className="btn btn-sm btn-primary"
                >
                  {submittingCreate ? "Creating…" : "Create Group"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Edit Group */}
      {/* ========================================================================= */}
      {editingGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Edit3 className="h-5 w-5 text-brand" />
                <h3 className="font-bold text-text-main text-base">Edit Device Group</h3>
              </div>
              <button
                onClick={() => setEditingGroup(null)}
                className="text-text-muted hover:text-text-main"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditGroup} className="p-5 space-y-4">
              {editError && (
                <div className="p-3 bg-danger/10 border border-danger/20 text-danger text-xs rounded-lg flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-text-main mb-1">
                  Group Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="input w-full text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-main mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="input w-full text-sm"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingGroup(null)}
                  className="btn btn-sm"
                  disabled={submittingEdit}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit || !editName.trim()}
                  className="btn btn-sm btn-primary"
                >
                  {submittingEdit ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Delete Group Confirmation */}
      {/* ========================================================================= */}
      {deletingGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-danger/5">
              <div className="flex items-center gap-2 text-danger">
                <AlertTriangle className="h-5 w-5" />
                <h3 className="font-bold text-base">Delete Device Group</h3>
              </div>
              <button
                onClick={() => setDeletingGroup(null)}
                className="text-text-muted hover:text-text-main"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-sm text-text-main">
                Are you sure you want to delete the group <b>&quot;{deletingGroup.name}&quot;</b>?
              </p>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-text-muted space-y-1">
                <div>• All <b>{deletingGroup.device_count}</b> member workstations will be unassigned from this group.</div>
                <div>• Unassigned workstations will safely fall back to the organization default policy.</div>
                <div>• No workstations will be deleted.</div>
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setDeletingGroup(null)}
                  className="btn btn-sm"
                  disabled={submittingDelete}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteGroup}
                  disabled={submittingDelete}
                  className="btn btn-sm bg-danger text-white hover:bg-danger/90"
                >
                  {submittingDelete ? "Deleting…" : "Delete Group"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Assign Group Policy */}
      {/* ========================================================================= */}
      {policyGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-teal-700" />
                <h3 className="font-bold text-text-main text-base">Assign Group Policy</h3>
              </div>
              <button
                onClick={() => setPolicyGroup(null)}
                className="text-text-muted hover:text-text-main"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAssignPolicy} className="p-5 space-y-4">
              {policyError && (
                <div className="p-3 bg-danger/10 border border-danger/20 text-danger text-xs rounded-lg flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span>{policyError}</span>
                </div>
              )}

              <div className="text-xs text-text-muted">
                Assigning a policy to <b>&quot;{policyGroup.name}&quot;</b> will apply to all <b>{policyGroup.device_count}</b> member workstations unless a workstation has a direct device policy override.
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-main mb-1">
                  Select Security Policy
                </label>
                <select
                  value={selectedPolicyId}
                  onChange={(e) => setSelectedPolicyId(e.target.value)}
                  className="select w-full text-sm"
                >
                  <option value="">None (Revert to Organization Default Policy)</option>
                  {policies.map((pol) => (
                    <option key={pol.id} value={pol.id}>
                      {pol.name} {pol.active_version_number ? `(v${pol.active_version_number})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setPolicyGroup(null)}
                  className="btn btn-sm"
                  disabled={submittingPolicy}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPolicy}
                  className="btn btn-sm btn-primary"
                >
                  {submittingPolicy ? "Saving…" : "Apply Policy"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
