"use client"

import React, { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { 
  ShieldCheck, Laptop, Terminal, Calendar, Activity, Settings, 
  Menu, X, LogOut, ChevronRight, AlertTriangle 
} from "lucide-react"

// ==========================================
// 1. Core Badges & Tags
// ==========================================

export function StatusBadge({ status }: { status: string }) {
  let classes = "bg-surface-container-low text-on-surface-variant border-outline-variant"
  let label = status

  const normalized = status.toUpperCase()
  if (normalized === "CURRENT" || normalized === "PASS" || normalized === "ONLINE" || normalized === "VERIFIED") {
    classes = "bg-status-success/10 text-status-success border-status-success/20"
  } else if (normalized === "OUTDATED_POLICY" || normalized === "OUTDATED" || normalized === "WARN" || normalized === "WARNING") {
    classes = "bg-warning/15 text-warning border-warning/30"
  } else if (normalized === "FAIL" || normalized === "FAILED" || normalized === "DECOMMISSIONED" || normalized === "POLICY_UNAVAILABLE") {
    classes = "bg-error/15 text-error border-error/30"
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border font-mono tracking-wide ${classes}`}>
      {label.replace("_", " ")}
    </span>
  )
}

export function SeverityBadge({ severity }: { severity: string }) {
  let classes = "bg-surface-container-low text-on-surface-variant border-outline-variant"
  const normalized = severity.toUpperCase()
  if (normalized === "HIGH" || normalized === "CRITICAL") {
    classes = "bg-error/10 text-error border-error/20"
  } else if (normalized === "MEDIUM") {
    classes = "bg-warning/10 text-warning border-warning/20"
  } else if (normalized === "LOW" || normalized === "INFO") {
    classes = "bg-surface-container-high text-on-surface-variant border-outline-variant"
  }

  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-extrabold border font-mono tracking-wide ${classes}`}>
      {normalized}
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
    <div className={`bg-surface-container border border-outline-variant rounded-xl overflow-hidden shadow-sm ${className}`}>
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
    <div className="bg-terminal-black border border-outline-variant rounded-xl overflow-hidden font-mono text-xs">
      <div className="px-4 py-2 border-b border-outline-variant flex items-center justify-between bg-surface-container-low/40">
        <span className="text-on-surface-variant flex items-center space-x-1.5 font-bold">
          <Terminal className="h-3.5 w-3.5 text-tertiary" />
          <span>{title}</span>
        </span>
        <button 
          onClick={handleCopy}
          className="text-[10px] font-bold text-tertiary hover:text-white transition-colors"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-on-surface leading-relaxed whitespace-pre bg-terminal-black">
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
    <div className="bg-surface-container border border-outline-variant rounded-xl p-5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-on-surface-variant font-bold uppercase tracking-wider font-mono">{label}</span>
        {status && <StatusBadge status={status} />}
      </div>
      <div className="text-2xl font-bold font-mono tracking-tight text-on-surface">{value}</div>
      {subtext && <p className="text-[10px] text-on-surface-variant">{subtext}</p>}
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
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-outline-variant/60">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-extrabold tracking-tight text-on-surface">{title}</h1>
        {subtitle && <p className="text-xs text-on-surface-variant font-medium">{subtitle}</p>}
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
    <div className="flex items-center justify-between pb-3 border-b border-outline-variant/50">
      <h3 className="text-xs font-bold uppercase tracking-wider flex items-center space-x-2 text-on-surface-variant font-mono">
        {Icon && <Icon className="h-3.5 w-3.5 text-tertiary" />}
        <span>{title}</span>
      </h3>
      {actions && <div className="flex items-center">{actions}</div>}
    </div>
  )
}

// ==========================================
// 3. States & Tables
// ==========================================

export function LoadingState({ message = "Loading details..." }: { message?: string }) {
  return (
    <div className="py-12 flex flex-col items-center justify-center space-y-3">
      <Activity className="h-6 w-6 text-tertiary animate-pulse" />
      <span className="text-xs text-on-surface-variant font-medium animate-pulse">{message}</span>
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
    <div className="p-8 text-center text-on-surface-variant text-xs flex flex-col items-center justify-center space-y-2 border border-dashed border-outline-variant rounded-xl bg-surface-container-low/20">
      <Icon className="h-8 w-8 text-on-surface-variant/40" />
      <p className="font-bold text-on-surface">{title}</p>
      {description && <p className="text-[10px] max-w-sm text-on-surface-variant/80">{description}</p>}
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
    <div className="overflow-x-auto border border-outline-variant rounded-xl bg-surface-container">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-outline-variant bg-surface-container-low/40 font-semibold text-on-surface-variant font-mono uppercase tracking-wider">
            {headers.map((h, i) => (
              <th key={i} className="px-4 py-3">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant/40 text-on-surface">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="px-4 py-8 text-center text-on-surface-variant">
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
    <div className="space-y-1">
      <h3 className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/50 font-mono px-3 pt-3">
        {title}
      </h3>
      <div className="space-y-0.5">{children}</div>
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
      <div className="flex items-center justify-between px-3 py-2 rounded-lg text-on-surface-variant/30 cursor-not-allowed text-xs font-medium select-none">
        <div className="flex items-center space-x-2.5">
          <Icon className="h-4 w-4 opacity-50" />
          <span>{label}</span>
        </div>
        {badge && (
          <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded border border-outline-variant/20 bg-surface-container-low text-on-surface-variant/30">
            {badge}
          </span>
        )}
      </div>
    )
  }

  return (
    <Link 
      href={href}
      className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
        isActive 
          ? "bg-surface-container-high text-on-surface font-bold border border-outline-variant/60" 
          : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low/40"
      }`}
    >
      <div className="flex items-center space-x-2.5">
        <Icon className={`h-4 w-4 ${isActive ? "text-tertiary" : "text-on-surface-variant/70"}`} />
        <span>{label}</span>
      </div>
      {badge && (
        <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border ${
          isActive 
            ? "border-tertiary/30 bg-tertiary/10 text-tertiary" 
            : "border-outline-variant bg-surface-container-low text-on-surface-variant"
        }`}>
          {badge}
        </span>
      )}
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
    <div className="flex flex-col h-full bg-surface-container-lowest border-r border-outline-variant/85 p-4 justify-between select-none">
      <div className="space-y-6">
        {/* Logo/Header */}
        <div className="flex items-center space-x-2.5 px-3 py-2">
          <ShieldCheck className="h-6 w-6 text-tertiary" />
          <span className="font-extrabold tracking-tight text-lg text-on-surface font-mono">FlientSec</span>
        </div>

        {/* Sidebar Sections */}
        <div className="space-y-4">
          <SidebarSection title="Overview">
            <SidebarLink href="/dashboard" label="Dashboard" icon={Activity} />
          </SidebarSection>

          <SidebarSection title="Posture">
            <SidebarLink href="/devices" label="Devices" icon={Laptop} disabled badge="Soon" />
            <SidebarLink href="/findings" label="Findings" icon={ShieldCheck} disabled badge="Soon" />
            <SidebarLink href="/activity" label="Activity" icon={Calendar} disabled badge="Soon" />
          </SidebarSection>

          <SidebarSection title="Control">
            <SidebarLink href="/policies" label="Policies" icon={Terminal} />
          </SidebarSection>

          <SidebarSection title="System">
            <SidebarLink href="/settings" label="Settings" icon={Settings} />
          </SidebarSection>
        </div>
      </div>

      {/* Footer / Account Section */}
      <div className="pt-4 border-t border-outline-variant/60 space-y-4">
        <div className="flex items-center justify-between px-3 py-1 bg-surface-container rounded-lg border border-outline-variant/40">
          <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider font-mono">Default Org</span>
          <span className="h-1.5 w-1.5 rounded-full bg-status-success"></span>
        </div>

        <div className="flex items-center justify-between px-2">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="h-8 w-8 rounded-full bg-tertiary-container text-on-tertiary-container flex-shrink-0 flex items-center justify-center text-xs font-bold uppercase border border-tertiary/20">
              {userEmail ? userEmail.slice(0, 2) : "AD"}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-on-surface truncate leading-none">Admin</p>
              <p className="text-[10px] text-on-surface-variant truncate mt-1 leading-none">
                {userEmail || "admin@flientsec.local"}
              </p>
            </div>
          </div>

          <button 
            onClick={onLogout}
            title="Sign Out"
            className="p-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="dark min-h-screen bg-surface text-on-surface flex flex-col lg:flex-row font-sans antialiased selection:bg-tertiary/20 selection:text-tertiary">
      {/* Desktop Sidebar (Persistent) */}
      <aside className="hidden lg:block w-[240px] flex-shrink-0 h-screen sticky top-0">
        {sidebarContent}
      </aside>

      {/* Mobile Top Bar */}
      <header className="lg:hidden h-14 border-b border-outline-variant/80 bg-surface-container-lowest/80 backdrop-blur sticky top-0 z-40 px-4 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <ShieldCheck className="h-5 w-5 text-tertiary" />
          <span className="font-extrabold tracking-tight text-base text-on-surface font-mono">FlientSec</span>
        </div>
        <button 
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div 
          onClick={() => setMobileOpen(false)}
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        />
      )}

      {/* Mobile Drawer Sidebar */}
      <div className={`lg:hidden fixed top-0 bottom-0 left-0 z-50 w-[240px] transform transition-transform duration-300 ease-in-out ${
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        {sidebarContent}
      </div>

      {/* Page Content area */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-8">
          {children}
        </main>
      </div>
    </div>
  )
}
