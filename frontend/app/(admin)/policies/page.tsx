"use client"

import React, { useEffect, useState } from "react"
import { ShieldCheck, ShieldAlert, Save, RefreshCw } from "lucide-react"

export default function PolicyManager() {
  const [yamlContent, setYamlContent] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

  const fetchPolicy = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${apiUrl}/api/v1/policies`)
      if (!res.ok) {
        throw new Error("Failed to load policy rules from server.")
      }
      const data = await res.json()
      setYamlContent(data.rules_yaml)
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

      // Get JWT token from admin login
      const loginRes = await fetch(`${apiUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          username: "admin@flientsec.local",
          password: "flientsec_admin_pass"
        })
      })
      if (!loginRes.ok) throw new Error("Auth failed during policy update verification.")
      const tokenData = await loginRes.json()

      const res = await fetch(`${apiUrl}/api/v1/policies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenData.access_token}`
        },
        body: JSON.stringify({ rules_yaml: yamlContent })
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.detail || "Failed to update organizational policy.")
      }

      setSuccess(true)
      fetchPolicy() // Refresh data
    } catch (err: any) {
      setError(err.message || "An error occurred while saving the policy.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8 flex-1 flex flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Security Policies</h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Configure target security posture rules, compliance limits, and severity values for your developers' workstations.
          </p>
        </div>
      </div>

      {success && (
        <div className="p-4 rounded-lg border border-success/30 bg-success/5 text-success text-sm flex items-center space-x-2">
          <ShieldCheck className="h-4 w-4 flex-shrink-0" />
          <span>Policies successfully updated and synchronized across the fleet.</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg border border-danger/30 bg-danger/5 text-danger text-sm flex items-center space-x-2">
          <ShieldAlert className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start flex-1">
        {/* Editor Area */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg flex flex-col h-[500px] shadow-premium">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono">
              policy.yaml
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={fetchPolicy}
                disabled={loading}
                className="p-1.5 border border-slate-200 text-slate-600 rounded bg-white hover:bg-slate-50 transition-colors"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>
              <button
                onClick={savePolicy}
                disabled={saving || loading}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-primary text-white text-xs font-bold rounded hover:bg-emerald-800 transition-colors disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{saving ? "Saving..." : "Save Policy"}</span>
              </button>
            </div>
          </div>
          <div className="flex-1 p-4 relative font-mono text-sm">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center text-slate-400 bg-white">
                Loading configuration data...
              </div>
            ) : (
              <textarea
                value={yamlContent}
                onChange={(e) => setYamlContent(e.target.value)}
                className="w-full h-full bg-slate-50/30 text-slate-800 font-mono text-xs p-4 focus:outline-none focus:ring-1 focus:ring-primary border border-slate-200 rounded resize-none"
                style={{ tabSize: 2 }}
              />
            )}
          </div>
        </div>

        {/* Documentation Sidebar */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-6 shadow-premium">
          <h2 className="text-sm font-bold uppercase tracking-wider border-b border-slate-200 pb-3 flex items-center space-x-2 text-slate-700">
            <span>Rule Syntax Guidelines</span>
          </h2>
          <div className="space-y-4 text-xs leading-relaxed text-slate-500">
            <p>
              FlientSec policies are defined in a clean, unified YAML notation.
            </p>
            <div className="space-y-3">
              <div>
                <p className="font-semibold text-slate-800">1. Check Options</p>
                <p className="mt-1">Each detector supports the following keys:</p>
                <ul className="list-disc pl-4 mt-1 space-y-1">
                  <li><span className="font-mono text-slate-800">enabled</span>: Boolean (true/false)</li>
                  <li><span className="font-mono text-slate-800">required</span>: Boolean (true/false)</li>
                  <li><span className="font-mono text-slate-800">severity</span>: String (HIGH, MEDIUM, LOW)</li>
                </ul>
              </div>

              <div>
                <p className="font-semibold text-slate-800">2. Custom Limits</p>
                <p className="mt-1">Runtimes support an additional version boundary check:</p>
                <ul className="list-disc pl-4 mt-1 space-y-1">
                  <li><span className="font-mono text-slate-800">minimum</span>: SemVer string (e.g. "22.0.0")</li>
                </ul>
              </div>

              <div>
                <p className="font-semibold text-slate-800">3. Score Impacts</p>
                <p className="mt-1">Failed checks reduce the workstation score based on severity:</p>
                <ul className="list-disc pl-4 mt-1 space-y-1">
                  <li><span className="font-mono text-success">LOW</span>: -10 points</li>
                  <li><span className="font-mono text-warning">MEDIUM</span>: -20 points</li>
                  <li><span className="font-mono text-danger">HIGH</span>: -40 points</li>
                </ul>
              </div>
            </div>
            <div className="p-3 border border-slate-100 rounded-lg bg-slate-50/50">
              <p className="font-bold text-slate-800">Important</p>
              <p className="mt-1">
                Laptops running the FlientSec daemon will fetch and apply these validations automatically on their next heartbeat interval (within 60 seconds).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
