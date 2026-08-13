"use client"

import React, { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Shield, ShieldAlert, ShieldCheck, Laptop, Terminal,
  Activity, Settings, Menu, X, LogOut, ChevronRight, AlertTriangle,
  FolderDot, Server, LayoutGrid, FileText
} from "lucide-react"

// ==========================================
// 1. Core Badges & Tags
// ==========================================

export function StatusBadge({ status }: { status: string }) {
  let cls = "badge-neutral"
  let label = status

  const normalized = status.toUpperCase()
  if (normalized === "CURRENT" || normalized === "PASS" || normalized === "ONLINE" || normalized === "VERIFIED" || normalized === "COMPLIANT") {
    cls = "badge-compliant"
    label = "Compliant"
  } else if (normalized === "OUTDATED_POLICY" || normalized === "OUTDATED" || normalized === "WARN" || normalized === "WARNING" || normalized === "UPDATE PENDING") {
    cls = "badge-warning"
    label = "Warning"
  } else if (normalized === "FAIL" || normalized === "FAILED" || normalized === "DECOMMISSIONED" || normalized === "POLICY_UNAVAILABLE" || normalized === "FAILING") {
    cls = "badge-failing"
    label = normalized === "DECOMMISSIONED" ? "Decommissioned" : "Failing"
  }

  // Format label to match custom mapping if needed
  if (normalized === "PASS") label = "Compliant"
  if (normalized === "FAIL") label = "Failing"
  if (normalized === "WARN") label = "Warning"
  if (normalized === "ONLINE") label = "Online"

  return (
    <span className={`badge ${cls}`}>
      <span className="dot"></span>
      {label}
    </span>
  )
}

export function SeverityBadge({ severity }: { severity: string }) {
  const normalized = severity.toUpperCase()
  let c = "sev-low"
  if (normalized === "HIGH" || normalized === "CRITICAL") {
    c = "sev-high"
  } else if (normalized === "MEDIUM") {
    c = "sev-medium"
  } else if (normalized === "LOW" || normalized === "INFO") {
    c = "sev-low"
  }

  return (
    <span className={`sev ${c}`}>
      {normalized}
    </span>
  )
}

export function ConnectionBadge({ status, lastSeen }: { status: string, lastSeen: string }) {
  const isOnline = status.toUpperCase() === "ONLINE"
  return (
    <span className={`conn ${isOnline ? 'online' : 'offline'}`}>
      <span className="dot"></span>
      {isOnline ? 'Online' : `Offline · ${lastSeen}`}
    </span>
  )
}

// ==========================================
// 2. Simple Panels & Layout Wrappers
// ==========================================

export function Panel({
  children,
  className = ""
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`panel ${className}`}>
      {children}
    </div>
  )
}

export function TerminalPanel({
  title,
  content,
  onCopy
}: {
  title: string
  content: string
  onCopy?: () => void
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    if (onCopy) onCopy()
  }

  return (
    <div className="evidence flex flex-col space-y-2">
      <div className="flex items-center justify-between pb-2 border-b border-border-soft">
        <span className="text-text-secondary font-bold font-sans text-xs">{title}</span>
        <button
          onClick={handleCopy}
          className="text-xs font-semibold text-brand hover:text-white transition-colors"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto pt-2 leading-relaxed whitespace-pre text-[12.6px] font-mono text-[#B9E6CD]">
        <code>{content}</code>
      </pre>
    </div>
  )
}

export function StatCard({
  label,
  value,
  subtext,
  status
}: {
  label: string
  value: string | number
  subtext?: string
  status?: string
}) {
  return (
    <div className="stat-cell panel flex flex-col justify-between">
      <div>
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
      </div>
      {subtext && <div className="stat-foot">{subtext}</div>}
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="page-head flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-sub">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center space-x-3">{actions}</div>}
    </div>
  )
}

export function SectionHeader({
  title,
  icon: Icon,
  actions
}: {
  title: string
  icon?: any
  actions?: React.ReactNode
}) {
  return (
    <div className="section-head">
      <div className="section-title">{title}</div>
      {actions && <div className="section-hint">{actions}</div>}
    </div>
  )
}

// ==========================================
// 3. States & Tables
// ==========================================

export function LoadingState({ message = "Loading details..." }: { message?: string }) {
  return (
    <div className="py-16 flex flex-col items-center justify-center space-y-4">
      <Activity className="h-7 w-7 text-brand animate-pulse" />
      <span className="text-sm text-text-secondary font-medium animate-pulse">{message}</span>
    </div>
  )
}

export function EmptyState({
  title,
  description,
  icon: Icon = ShieldCheck
}: {
  title: string
  description?: string
  icon?: any
}) {
  return (
    <div className="empty">
      <Icon className="h-6 w-6 text-text-muted mb-3 mx-auto" />
      <div className="empty-title">{title}</div>
      {description && <div className="empty-body">{description}</div>}
    </div>
  )
}

export function DataTable({
  headers,
  rows,
  renderRow
}: {
  headers: string[]
  rows: any[]
  renderRow: (row: any, idx: number) => React.ReactNode
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="text-center text-text-muted py-8">
                No records found.
              </td>
            </tr>
          ) : (
            rows.map((row, idx) => renderRow(row, idx))
          )}
        </tbody>
      </table>
    </div>
  )
}

// ==========================================
// 4. Sidebar components
// ==========================================

export function SidebarSection({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="nav-group">
      <div className="nav-label">{title}</div>
      {children}
    </div>
  )
}

export function SidebarLink({
  href,
  label,
  icon: Icon,
  disabled = false,
  badge
}: {
  href: string
  label: string
  icon: any
  disabled?: boolean
  badge?: string
}) {
  const pathname = usePathname()
  const isActive = pathname === href

  if (disabled) {
    return (
      <div className="flex items-center justify-between px-3 py-2 rounded-lg text-text-muted/50 cursor-not-allowed text-[13.8px] font-medium select-none">
        <div className="flex items-center space-x-2.5">
          <Icon className="h-4 w-4 opacity-50" />
          <span>{label}</span>
        </div>
        {badge && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-border bg-surface-2 text-text-muted/50">
            {badge}
          </span>
        )}
      </div>
    )
  }

  return (
    <Link
      href={href}
      className={`nav-item ${isActive ? "active" : ""}`}
    >
      <Icon />
      <span>{label}</span>
    </Link>
  )
}

// ==========================================
// 5. Unified AppShell Structure
// ==========================================

export function AppShell({
  children,
  userEmail,
  onLogout
}: {
  children: React.ReactNode
  userEmail: string | null
  onLogout: () => void
}) {
  const [mobileOpen, setMobileOpen] = useState(false)

  const sidebarContent = (
    <>
      <div className="brand">
        <div className="brand-mark">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2 3 6v6c0 5 4 8.5 9 10 5-1.5 9-5 9-10V6l-9-4Z"/>
          </svg>
        </div>
        <span className="brand-name">FLIENTSEC</span>
      </div>

      <SidebarSection title="Overview">
        <SidebarLink href="/dashboard" label="Dashboard" icon={LayoutGrid} />
      </SidebarSection>

      <SidebarSection title="Posture">
        <SidebarLink href="/devices" label="Devices" icon={Server} />
        <SidebarLink href="/findings" label="Findings" icon={Shield} />
        <SidebarLink href="/activity" label="Activity" icon={Activity} />
      </SidebarSection>

      <SidebarSection title="Control">
        <SidebarLink href="/policies" label="Policies" icon={FileText} />
      </SidebarSection>

      <SidebarSection title="System">
        <SidebarLink href="/settings" label="Settings" icon={Settings} />
      </SidebarSection>

      <div className="sidebar-footer">
        <div className="org-avatar">DO</div>
        <div className="min-w-0 flex-1">
          <div className="org-name truncate">Default Org</div>
          <div className="org-role truncate">{userEmail || "Administrator"}</div>
        </div>
        <button
          onClick={onLogout}
          title="Sign Out"
          className="btn btn-ghost btn-sm p-1 hover:text-danger"
        >
          <LogOut className="h-4.5 w-4.5" />
        </button>
      </div>
    </>
  )

  return (
    <div className="dark min-h-screen bg-bg text-text-primary font-sans antialiased selection:bg-brand selection:text-bg">
      <div className="app">
        {/* Desktop Sidebar (Persistent) */}
        <aside className="hidden lg:flex sidebar">
          {sidebarContent}
        </aside>

        {/* Mobile Top Bar */}
        <div className="mobile-topbar lg:hidden">
          <button onClick={() => setMobileOpen(!mobileOpen)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <span style={{ fontWeight: 700, fontSize: "14px" }}>FlientSec</span>
        </div>

        {/* Mobile Drawer Backdrop */}
        <div
          onClick={() => setMobileOpen(false)}
          className={`sidebar-scrim ${mobileOpen ? 'open' : ''}`}
        />

        {/* Mobile Drawer Sidebar */}
        <aside className={`sidebar lg:hidden fixed top-0 bottom-0 left-0 transition-transform duration-200 ${
          mobileOpen ? "open" : "-translate-x-full"
        }`}>
          {sidebarContent}
        </aside>

        {/* Page Content area */}
        <main className="main flex flex-col">
          <div className="view active">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
