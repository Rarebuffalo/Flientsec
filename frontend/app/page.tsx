"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  Laptop, 
  Terminal, 
  ArrowRight, 
  Lock, 
  Clock, 
  Code, 
  Server, 
  Check, 
  X, 
  Github, 
  Eye, 
  Cpu, 
  Activity, 
  HelpCircle, 
  Layers,
  Sparkles,
  Clipboard,
  Smartphone,
  ChevronDown,
  Building,
  User,
  Users
} from "lucide-react"

// Framer motion variants for scroll-reveal animations
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
}

export default function LandingPage() {
  // Navigation active state
  const [activeTab, setActiveTab] = useState<"overview" | "devices" | "policies">("devices")
  
  // Interactive mock dashboard variables
  const [firewallActive, setFirewallActive] = useState(false)
  const [recentEvents, setRecentEvents] = useState<string[]>([
    "dev-laptop-01: Heartbeat received (Online)",
    "dev-laptop-02: Compliance status PASS (Score: 100)",
  ])
  const [copiedCmd, setCopiedCmd] = useState(false)

  // Trigger event log addition when firewall changes
  useEffect(() => {
    const timestamp = new Date().toLocaleTimeString()
    if (firewallActive) {
      setRecentEvents(prev => [
        `[${timestamp}] dev-laptop-01: Firewall ENABLED -> Status PASS (Score: 85)`,
        ...prev.slice(0, 4)
      ])
    } else {
      setRecentEvents(prev => [
        `[${timestamp}] dev-laptop-01: Firewall DISABLED -> Status FAIL (Score: 45)`,
        ...prev.slice(0, 4)
      ])
    }
  }, [firewallActive])

  const copyInstallerCommand = () => {
    navigator.clipboard.writeText("curl -fsSL https://flientsec.dev/install.sh | bash")
    setCopiedCmd(true)
    setTimeout(() => setCopiedCmd(false), 2000)
  }

  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index)
  }

  const faqData = [
    {
      q: "Why Linux first?",
      a: "Linux-first allows us to solve one of the least served workstation security markets before expanding to additional operating systems. Developer setups on Arch, Ubuntu, and Fedora are often left out of traditional IT security policies due to lack of agent compatibility. FlientSec fixes this gap native to Linux configurations."
    },
    {
      q: "Why not use Microsoft Intune or Jamf?",
      a: "Traditional MDM platforms require intrusive device configuration profiles that lock down user settings, block developer tools, and are famously difficult to deploy on Linux environments. Furthermore, they often monitor arbitrary user activity. FlientSec is lightweight, non-intrusive, evaluates policies strictly local to the machine via YAML, and respects developer privacy."
    },
    {
      q: "Does FlientSec read or collect my source code?",
      a: "No. The agent checks security properties—like disk encryption, local SSH port settings, and package manager versions. It does not scan, index, read, or upload any source code, repository directories, browser histories, or keyboard inputs."
    },
    {
      q: "Does it monitor employee activity or screenshots?",
      a: "Absolutely not. FlientSec contains no screenshot capturing, keystroke logging, or screen recording capabilities. It strictly monitors security configuration metadata."
    },
    {
      q: "How is telemetry data secured?",
      a: "All workstation check-ins and heartbeats are encrypted and transmitted via HTTPS. Telemetry data is authenticated using a secure workstation-generated client identity certificate stored locally on the machine."
    },
    {
      q: "Does it work offline?",
      a: "Yes. If a workstation is offline, the Go agent continues to execute local checks at the scheduled interval. Telemetry reports cache inside an in-memory queue and are flushed to the cloud portal immediately when the workstation reconnects to the network."
    }
  ]

  return (
    <div className="bg-[#F8FAF8] text-slate-600 min-h-screen selection:bg-emerald-100 selection:text-emerald-900 font-sans antialiased">
      
      {/* 1. Announcement Bar */}
      <div className="bg-darkGreen text-emerald-300 text-xs py-3 px-4 text-center font-semibold tracking-wider z-50 relative">
        Developer Workstation Security Platform <span className="mx-2">•</span> Launching Design Partner Program
      </div>

      {/* 2. Navigation Header */}
      <header className="border-b border-slate-200 bg-[#F8FAF8]/95 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-10">
            <Link href="/" className="flex items-center space-x-2.5">
              <img src="/logo_dark.png" alt="FlientSec Logo" className="h-7 w-7 object-contain" />
              <span className="font-extrabold tracking-tight text-2xl text-slate-900 bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 bg-clip-text text-transparent">FlientSec</span>
            </Link>
            <nav className="hidden md:flex items-center space-x-8 text-sm font-semibold text-slate-500">
              <a href="#product" className="hover:text-slate-900 transition-colors">Product</a>
              <a href="#architecture" className="hover:text-slate-900 transition-colors">Architecture</a>
              <a href="#plans" className="hover:text-slate-900 transition-colors">Plans</a>
              <Link href="/dashboard" className="hover:text-slate-900 transition-colors">Docs</Link>
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/dashboard" className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
              Sign In
            </Link>
            <a 
              href="#cta" 
              className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-bold rounded bg-primary hover:bg-emerald-800 text-white transition-colors shadow-sm"
            >
              Request Early Access
            </a>
          </div>
        </div>
      </header>

      {/* 3. Hero Section (Light Background) */}
      <section id="product" className="py-20 md:py-28 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
          
          {/* Hero Left Column */}
          <div className="lg:col-span-6 space-y-8">
            <motion.div 
              initial="hidden" 
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              className="space-y-6"
            >
              <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight">
                Stop chasing compliance screenshots. <span className="text-primary">Know every workstation is secure.</span>
              </h1>
              <p className="text-lg sm:text-xl text-slate-500 font-normal leading-relaxed">
                FlientSec continuously verifies developer workstations against your security baseline. Always know what is compliant, what isn't, and exactly how to fix it—without installing heavy enterprise MDM profiles.
              </p>
            </motion.div>

            {/* CTAs & Installer card */}
            <motion.div 
              initial="hidden" 
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              className="space-y-6"
            >
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                <a 
                  href="#cta" 
                  className="inline-flex items-center justify-center px-6 py-3.5 bg-primary hover:bg-emerald-800 text-white text-base font-bold rounded-lg transition-colors shadow-sm text-center"
                >
                  Request Early Access
                </a>
                <a 
                  href="/dashboard" 
                  className="inline-flex items-center justify-center px-6 py-3.5 border border-slate-300 hover:bg-slate-50 text-slate-700 text-base font-semibold rounded-lg transition-colors text-center"
                >
                  See Documentation
                </a>
              </div>

              {/* Styled copyable terminal widget */}
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 max-w-md shadow-lg flex items-center justify-between font-mono text-xs">
                <div className="flex items-center space-x-2 text-slate-400 select-all overflow-hidden truncate mr-4">
                  <span className="text-emerald-500 font-bold">$</span>
                  <span className="truncate">curl -fsSL https://flientsec.dev/install.sh | bash</span>
                </div>
                <button 
                  onClick={copyInstallerCommand}
                  className="flex-shrink-0 p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                  title="Copy command"
                >
                  {copiedCmd ? <span className="text-[10px] text-emerald-400 font-bold">Copied!</span> : <Clipboard className="h-4 w-4" />}
                </button>
              </div>
            </motion.div>
          </div>

          {/* Hero Right Column - High Fidelity SaaS Frontend Application Mockup */}
          <div className="lg:col-span-6 relative">
            {/* Custom subtle floating animation wrapper */}
            <div className="animate-[bounce_6s_infinite_ease-in-out] hover:pause">
              <div className="bg-white border border-slate-200 rounded-xl shadow-premium overflow-hidden font-sans flex h-[480px] w-full">
                
                {/* Dashboard Sidebar Mockup */}
                <div className="w-48 bg-slate-900 text-slate-350 p-4 border-r border-slate-800 flex flex-col justify-between flex-shrink-0 text-xs font-semibold">
                  <div className="space-y-6">
                    {/* Sidebar Brand logo */}
                    <div className="flex items-center space-x-2 border-b border-slate-800 pb-4">
                      <img src="/logo_light.png" alt="Logo" className="h-5 w-5 object-contain" />
                      <span className="font-extrabold tracking-tight text-sm text-white">FlientSec</span>
                    </div>

                    {/* Sidebar Menu */}
                    <div className="space-y-1">
                      <button 
                        onClick={() => setActiveTab("overview")}
                        className={`w-full flex items-center space-x-2 px-2.5 py-1.5 rounded transition-colors text-left ${activeTab === "overview" ? "bg-slate-800 text-white" : "hover:bg-slate-850 hover:text-white"}`}
                      >
                        <Layers className="h-3.5 w-3.5" />
                        <span>Overview</span>
                      </button>
                      <button 
                        onClick={() => setActiveTab("devices")}
                        className={`w-full flex items-center space-x-2 px-2.5 py-1.5 rounded transition-colors text-left ${activeTab === "devices" ? "bg-slate-800 text-white" : "hover:bg-slate-850 hover:text-white"}`}
                      >
                        <Laptop className="h-3.5 w-3.5" />
                        <span>Devices</span>
                        <span className="ml-auto bg-slate-700 text-slate-300 text-[10px] px-1 rounded">3</span>
                      </button>
                      <button 
                        onClick={() => setActiveTab("policies")}
                        className={`w-full flex items-center space-x-2 px-2.5 py-1.5 rounded transition-colors text-left ${activeTab === "policies" ? "bg-slate-800 text-white" : "hover:bg-slate-850 hover:text-white"}`}
                      >
                        <Code className="h-3.5 w-3.5" />
                        <span>Policies</span>
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-slate-800 pt-4 flex items-center space-x-2">
                    <div className="h-6 w-6 rounded-full bg-emerald-700 flex items-center justify-center text-[10px] font-bold text-white">AD</div>
                    <div className="truncate">
                      <p className="text-[10px] text-white leading-none">Admin User</p>
                      <p className="text-[8px] text-slate-500 leading-none mt-1 truncate">admin@flientsec.local</p>
                    </div>
                  </div>
                </div>

                {/* Dashboard Main Content Panel */}
                <div className="flex-1 bg-slate-50/50 flex flex-col overflow-hidden text-xs text-slate-600">
                  
                  {/* Top Bar */}
                  <div className="h-12 border-b border-slate-200 bg-white px-4 flex items-center justify-between flex-shrink-0">
                    <span className="font-semibold text-slate-800 capitalize">
                      {activeTab === "devices" ? "Device Profile" : activeTab === "policies" ? "Rules Editor" : "System Overview"}
                    </span>
                    <span className="text-[10px] border border-slate-200 px-2 py-0.5 rounded bg-white text-slate-400">Default Org</span>
                  </div>

                  {/* Active view component */}
                  <div className="flex-1 p-5 overflow-y-auto space-y-4">
                    
                    {/* View A: Overview stats tab */}
                    {activeTab === "overview" && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-2.5">
                          <div className="bg-white p-3 border border-slate-200 rounded shadow-sm">
                            <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Total</p>
                            <p className="text-xl font-bold text-slate-900 mt-1">3</p>
                          </div>
                          <div className="bg-white p-3 border border-slate-200 rounded shadow-sm">
                            <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider text-emerald-600">Secure</p>
                            <p className="text-xl font-bold text-emerald-600 mt-1">2</p>
                          </div>
                          <div className="bg-white p-3 border border-slate-200 rounded shadow-sm">
                            <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider text-rose-500">Failed</p>
                            <p className="text-xl font-bold text-rose-500 mt-1">1</p>
                          </div>
                        </div>

                        <div className="bg-white border border-slate-200 rounded shadow-sm overflow-hidden">
                          <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 font-bold text-slate-700">Workstations</div>
                          <div className="divide-y divide-slate-100 font-mono text-[10px]">
                            <div className="p-2.5 flex items-center justify-between">
                              <span className="font-semibold">dev-laptop-01</span>
                              <span className="text-rose-500 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded text-[9px] font-bold">FAIL (45%)</span>
                            </div>
                            <div className="p-2.5 flex items-center justify-between">
                              <span className="font-semibold">dev-laptop-02</span>
                              <span className="text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded text-[9px] font-bold">PASS (100%)</span>
                            </div>
                            <div className="p-2.5 flex items-center justify-between">
                              <span className="font-semibold">dev-laptop-03</span>
                              <span className="text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded text-[9px] font-bold">PASS (90%)</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* View B: Active Device Profile Tab */}
                    {activeTab === "devices" && (
                      <div className="space-y-4">
                        {/* Device summary block */}
                        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <h5 className="font-mono font-bold text-slate-900 text-sm">dev-laptop-01</h5>
                              <p className="text-[10px] text-slate-400 mt-0.5">Arch Linux • Kernel 6.9.1 • Intel x86_64</p>
                            </div>
                            <div className="text-right">
                              <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                                firewallActive ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-rose-50 text-rose-500 border border-rose-100"
                              }`}>
                                {firewallActive ? "COMPLIANT" : "VIOLATION"}
                              </span>
                              <p className="text-[10px] font-bold text-slate-500 font-mono mt-1">Score: {mockScore}/100</p>
                            </div>
                          </div>

                          {/* Interactive Firewall Toggle switch card */}
                          <div className="border border-slate-100 rounded bg-slate-50/50 p-2.5 flex items-center justify-between font-mono text-[10px]">
                            <div className="flex items-center space-x-2">
                              {firewallActive ? <ShieldCheck className="h-4 w-4 text-emerald-500" /> : <ShieldAlert className="h-4 w-4 text-rose-500" />}
                              <span className="font-semibold text-slate-800">Firewall Ruleset (UFW)</span>
                            </div>
                            <div className="flex items-center space-x-2 font-sans">
                              <button 
                                onClick={() => setFirewallActive(!firewallActive)}
                                className={`w-8 h-4 rounded-full p-0.5 transition-colors focus:outline-none ${firewallActive ? "bg-primary" : "bg-slate-350"}`}
                              >
                                <div className={`bg-white w-3 h-3 rounded-full shadow-sm transform transition-transform ${firewallActive ? "translate-x-4" : "translate-x-0"}`}></div>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Event Feed */}
                        <div className="bg-slate-900 text-slate-300 rounded-lg p-3 border border-slate-800 shadow-sm space-y-2">
                          <p className="text-[9px] uppercase font-bold text-slate-500 tracking-wider font-sans">Heartbeat telemetry log</p>
                          <div className="space-y-1 font-mono text-[9px] leading-relaxed">
                            {recentEvents.map((evt, idx) => (
                              <p key={idx} className="truncate select-none">
                                <span className="text-slate-500">&gt;</span> {evt}
                              </p>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* View C: Policy rules YAML Tab */}
                    {activeTab === "policies" && (
                      <div className="bg-slate-900 text-slate-200 border border-slate-800 rounded-lg p-3.5 h-[360px] font-mono text-[10px] leading-relaxed select-all overflow-hidden">
                        <p className="text-slate-500"># Org target baseline requirements</p>
                        <p className="text-emerald-400">checks:</p>
                        <p className="pl-4 text-emerald-400">firewall:</p>
                        <p className="pl-8"><span className="text-slate-400">enabled:</span> true</p>
                        <p className="pl-8"><span className="text-slate-400">severity:</span> high</p>
                        <p className="pl-4 text-emerald-400">encryption:</p>
                        <p className="pl-8"><span className="text-slate-400">enabled:</span> true</p>
                        <p className="pl-8"><span className="text-slate-400">severity:</span> high</p>
                        <p className="pl-4 text-emerald-400">node:</p>
                        <p className="pl-8"><span className="text-slate-400">enabled:</span> true</p>
                        <p className="pl-8"><span className="text-slate-400">minimum:</span> "22.0.0"</p>
                        <p className="pl-8"><span className="text-slate-400">severity:</span> medium</p>
                      </div>
                    )}

                  </div>

                </div>

              </div>
            </div>
          </div>

        </div>
      </section>

      {/* 4. Credibility Trust Strip (Light Background) */}
      <section className="py-14 border-y border-slate-200/60 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs font-bold text-slate-400 uppercase tracking-widest mb-8">
            Designed for Linux Engineering Teams • Open Architecture • Privacy by Design
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="space-y-1.5">
              <p className="text-slate-900 font-bold text-base">Linux Native</p>
              <p className="text-xs text-slate-455 text-slate-400 font-medium">Arch, Ubuntu, Fedora, Debian</p>
            </div>
            <div className="space-y-1.5">
              <p className="text-slate-900 font-bold text-base">Policy as Code</p>
              <p className="text-xs text-slate-455 text-slate-400 font-medium">Standard YAML template rules</p>
            </div>
            <div className="space-y-1.5">
              <p className="text-slate-900 font-bold text-base">Privacy First</p>
              <p className="text-xs text-slate-455 text-slate-400 font-medium">Security metadata, zero surveillance</p>
            </div>
            <div className="space-y-1.5">
              <p className="text-slate-900 font-bold text-base">Always Verified</p>
              <p className="text-xs text-slate-455 text-slate-400 font-medium">Heartbeats & pings continuously</p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Problem Section (Deep Green Background #103B33) */}
      <section className="py-28 bg-darkGreen text-white relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
            <span className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase border border-emerald-500/20 px-2.5 py-1 rounded bg-emerald-500/5">
              Workstation Auditing Pain
            </span>
            <h2 className="text-4xl font-extrabold tracking-tight text-white mt-4">
              Manual screenshot chases belong in the past
            </h2>
            <p className="text-emerald-100/70 text-base max-w-2xl mx-auto font-medium">
              Chasing developers for security configuration snapshots is a waste of engineering time. Transition from manual tracking loops to automation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-stretch max-w-5xl mx-auto">
            {/* Old Manual Flow Card */}
            <div className="border border-emerald-900 bg-slate-950/20 p-8 rounded-xl flex flex-col justify-between space-y-8">
              <div className="space-y-4">
                <span className="text-[10px] font-bold text-rose-300 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded uppercase tracking-wider">
                  Manual audits
                </span>
                <h3 className="text-2xl font-bold text-white leading-tight">Chasing Screen Captures</h3>
                <p className="text-sm text-emerald-100/60 leading-relaxed font-medium">
                  Slack message pings to developers, collection of screenshots, spreadsheet entry tracking, and static compliance reports that are outdated the day they are generated.
                </p>
              </div>
              
              {/* Flow mapping diagram */}
              <div className="space-y-4">
                <div className="flex items-center space-x-3 text-xs font-mono font-bold text-rose-300">
                  <span>Slack</span>
                  <ArrowRight className="h-3 w-3" />
                  <span>Screenshots</span>
                  <ArrowRight className="h-3 w-3" />
                  <span>Spreadsheet</span>
                  <ArrowRight className="h-3 w-3" />
                  <span>Audit</span>
                </div>
                <div className="pt-4 border-t border-emerald-950 flex items-center space-x-2 text-rose-400 font-mono font-bold text-lg">
                  <span>Hours of manual follow-up</span>
                </div>
              </div>
            </div>

            {/* New Automated Flow Card */}
            <div className="border-2 border-emerald-700/50 bg-[#14473e] p-8 rounded-xl flex flex-col justify-between space-y-8">
              <div className="space-y-4">
                <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded uppercase tracking-wider">
                  FlientSec
                </span>
                <h3 className="text-2xl font-bold text-white leading-tight">Continuous Posture Verification</h3>
                <p className="text-sm text-emerald-100/75 leading-relaxed font-medium">
                  Background agent runs configuration checks, applies organization standards locally via policy-as-code, and logs status telemetry instantly to the audit trail.
                </p>
              </div>
              
              {/* Flow mapping diagram */}
              <div className="space-y-4">
                <div className="flex items-center space-x-3 text-xs font-mono font-bold text-emerald-300">
                  <span>Agent</span>
                  <ArrowRight className="h-3 w-3" />
                  <span>Verification</span>
                  <ArrowRight className="h-3 w-3" />
                  <span>Dashboard</span>
                  <ArrowRight className="h-3 w-3" />
                  <span>Evidence</span>
                </div>
                <div className="pt-4 border-t border-emerald-800/80 flex items-center space-x-2 text-emerald-300 font-mono font-bold text-lg">
                  <span>Automated verification</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Why FlientSec Exists & "Not For" */}
      <section className="py-24 bg-white border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
            
            {/* Why we exist */}
            <div className="lg:col-span-7 space-y-6">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Why FlientSec Exists</h2>
              <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
                Built for modern engineering teams who need security maturity.
              </h3>
              <p className="text-base text-slate-500 leading-relaxed font-medium">
                Engineering organizations increasingly need to demonstrate security maturity to enterprise customers. Yet verifying developer workstations is still a manual process involving screenshots, spreadsheets, and periodic audits. FlientSec replaces that workflow with continuous, policy-driven verification designed for modern engineering teams.
              </p>
            </div>

            {/* "Not For" boundaries block */}
            <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-8 space-y-6">
              <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Platform boundaries</h4>
              <div className="space-y-4 text-xs font-medium leading-relaxed">
                <div>
                  <p className="text-slate-800 font-bold flex items-center space-x-2">
                    <span className="h-2 w-2 rounded-full bg-primary"></span>
                    <span>Who FlientSec is built for:</span>
                  </p>
                  <p className="text-slate-500 mt-1 pl-4">
                    Engineering organizations that need continuous workstation posture verification to pass security audits and close enterprise contracts.
                  </p>
                </div>
                <div className="pt-4 border-t border-slate-200">
                  <p className="text-slate-800 font-bold flex items-center space-x-2">
                    <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                    <span>What FlientSec is NOT:</span>
                  </p>
                  <ul className="text-slate-500 mt-1.5 pl-4 space-y-1.5 list-disc">
                    <li>Not a Mobile Device Management (MDM) profile locker</li>
                    <li>Not an employee surveillance or activity monitor</li>
                    <li>Not an endpoint antivirus or file scanner</li>
                  </ul>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 7. Technical Architecture (Light Background) */}
      <section id="architecture" className="py-24 border-b border-slate-200/60 bg-slate-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Symmetric Platform Architecture</h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Symmetric local policy evaluation
            </h3>
            <p className="text-slate-500 text-sm sm:text-base font-medium">
              FlientSec leverages a distributed evaluation model where policy checks execute entirely on the client workstation.
            </p>
          </div>

          {/* SVG schema diagram */}
          <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-premium flex flex-col md:flex-row items-center gap-12">
            
            {/* SVG Illustration Column */}
            <div className="flex-1 w-full flex items-center justify-center">
              <svg 
                viewBox="0 0 800 240" 
                className="w-full max-w-2xl font-sans text-[11px]" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Node Containers */}
                <rect x="10" y="70" width="130" height="80" rx="8" fill="#F1F5F9" stroke="#E2E8F0" strokeWidth="2" />
                <rect x="190" y="70" width="130" height="80" rx="8" fill="#F1F5F9" stroke="#E2E8F0" strokeWidth="2" />
                <rect x="370" y="70" width="140" height="80" rx="8" fill="#103B33" stroke="#103B33" strokeWidth="2" />
                <rect x="560" y="70" width="130" height="80" rx="8" fill="#F8FAF8" stroke="#E2E8F0" strokeWidth="2" />

                {/* Connecting lines */}
                <path d="M 140 110 L 190 110" stroke="#CBD5E1" strokeWidth="2" markerEnd="url(#arrow)" />
                <path d="M 320 110 L 370 110" stroke="#CBD5E1" strokeWidth="2" markerEnd="url(#arrow)" />
                <path d="M 510 110 L 560 110" stroke="#CBD5E1" strokeWidth="2" markerEnd="url(#arrow)" />

                {/* Local highlight container */}
                <rect x="5" y="30" width="325" height="150" rx="12" stroke="#10B981" strokeWidth="2" strokeDasharray="6 4" fill="none" />
                <text x="167" y="22" textAnchor="middle" fill="#10B981" fontWeight="bold" fontSize="10">Local Workstation Boundary</text>

                {/* Text labels inside nodes */}
                <text x="75" y="105" textAnchor="middle" fill="#0F172A" fontWeight="bold">Workstation</text>
                <text x="75" y="122" textAnchor="middle" fill="#64748B" fontSize="9">Arch / Ubuntu</text>

                <text x="255" y="105" textAnchor="middle" fill="#0F172A" fontWeight="bold">Go Agent</text>
                <text x="255" y="122" textAnchor="middle" fill="#64748B" fontSize="9">Local Checks</text>

                <text x="440" y="105" textAnchor="middle" fill="#39D98A" fontWeight="bold">Secure API</text>
                <text x="440" y="122" textAnchor="middle" fill="#A7F3D0" fontSize="9">HTTPS Telemetry</text>

                <text x="625" y="105" textAnchor="middle" fill="#0F172A" fontWeight="bold">SaaS Dashboard</text>
                <text x="625" y="122" textAnchor="middle" fill="#64748B" fontSize="9">Audit Reports</text>

                {/* Marker definitions */}
                <defs>
                  <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#CBD5E1" />
                  </marker>
                </defs>
              </svg>
            </div>

            {/* Explanatory callout Column */}
            <div className="w-full md:w-80 space-y-4">
              <div className="p-4 border-2 border-emerald-500/20 bg-emerald-500/5 rounded-lg">
                <h4 className="font-bold text-slate-800 text-xs flex items-center space-x-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <span>Competitive Advantage</span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-2 font-medium leading-relaxed">
                  All security posture evaluations occur locally on the workstation. Telemetry payloads only report compliance results—your source code and user activities never leave the machine.
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 8. Scannable Feature Cards (Light Background) */}
      <section className="py-24 bg-white border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Platform Features</h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Workstation security verification, automated
            </h3>
          </div>

          {/* Scannable cards layout: Title -> 1-sentence value -> bullet checks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="border border-slate-200/80 rounded-xl p-8 hover:border-slate-350 transition-colors bg-[#F8FAF8]/30 space-y-5 shadow-sm">
              <div className="h-9 w-9 rounded-lg bg-emerald-55 bg-emerald-50 border border-emerald-100 flex items-center justify-center text-primary">
                <Cpu className="h-4.5 w-4.5" />
              </div>
              <div className="space-y-2">
                <h4 className="text-lg font-bold text-slate-900">Continuous Verification</h4>
                <p className="text-xs text-slate-555 text-slate-500 font-medium">Verify system security baselines continuously in the background.</p>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-800 font-semibold pt-2 border-t border-slate-100">
                <li className="flex items-center space-x-2">
                  <Check className="h-3.5 w-3.5 text-primary" />
                  <span>Firewall ruleset status (UFW, firewalld, iptables)</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Check className="h-3.5 w-3.5 text-primary" />
                  <span>Disk encryption mount analysis (lsblk)</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Check className="h-3.5 w-3.5 text-primary" />
                  <span>System package manager upgrade alerts</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Check className="h-3.5 w-3.5 text-primary" />
                  <span>Local compiler runtime environment versions</span>
                </li>
              </ul>
            </div>

            <div className="border border-slate-200/80 rounded-xl p-8 hover:border-slate-350 transition-colors bg-[#F8FAF8]/30 space-y-5 shadow-sm">
              <div className="h-9 w-9 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-primary">
                <Code className="h-4.5 w-4.5" />
              </div>
              <div className="space-y-2">
                <h4 className="text-lg font-bold text-slate-900">Policy as Code</h4>
                <p className="text-xs text-slate-500 font-medium">Define rulesets in a single git-controlled YAML configuration.</p>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-800 font-semibold pt-2 border-t border-slate-100">
                <li className="flex items-center space-x-2">
                  <Check className="h-3.5 w-3.5 text-primary" />
                  <span>Central rules configuration via policy.yaml</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Check className="h-3.5 w-3.5 text-primary" />
                  <span>Custom scoring deduct weights per rule failure</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Check className="h-3.5 w-3.5 text-primary" />
                  <span>Dynamic policy updates distributed during checks</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Check className="h-3.5 w-3.5 text-primary" />
                  <span>Distro-agnostic execution support</span>
                </li>
              </ul>
            </div>

            <div className="border border-slate-200/80 rounded-xl p-8 hover:border-slate-350 transition-colors bg-[#F8FAF8]/30 space-y-5 shadow-sm">
              <div className="h-9 w-9 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-primary">
                <Activity className="h-4.5 w-4.5" />
              </div>
              <div className="space-y-2">
                <h4 className="text-lg font-bold text-slate-900">Fleet Health Overview</h4>
                <p className="text-xs text-slate-500 font-medium">Get instant visibility into overall workstation compliance levels.</p>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-800 font-semibold pt-2 border-t border-slate-100">
                <li className="flex items-center space-x-2">
                  <Check className="h-3.5 w-3.5 text-primary" />
                  <span>Heartbeat check pings validating active workstations</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Check className="h-3.5 w-3.5 text-primary" />
                  <span>Status dashboards grading fleet checks (PASS/WARN/FAIL)</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Check className="h-3.5 w-3.5 text-primary" />
                  <span>Hardware architecture specs and kernel logs</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Check className="h-3.5 w-3.5 text-primary" />
                  <span>Historical check-in registers database logs</span>
                </li>
              </ul>
            </div>

            <div className="border border-slate-200/80 rounded-xl p-8 hover:border-slate-350 transition-colors bg-[#F8FAF8]/30 space-y-5 shadow-sm">
              <div className="h-9 w-9 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-primary">
                <Clock className="h-4.5 w-4.5" />
              </div>
              <div className="space-y-2">
                <h4 className="text-lg font-bold text-slate-900">Audit Evidence Logs</h4>
                <p className="text-xs text-slate-500 font-medium">Generate compliance documentation ready to pass security audits.</p>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-800 font-semibold pt-2 border-t border-slate-100">
                <li className="flex items-center space-x-2">
                  <Check className="h-3.5 w-3.5 text-primary" />
                  <span>Downloadable CSV reports documenting workstation states</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Check className="h-3.5 w-3.5 text-primary" />
                  <span>Chronological transitions recorded automatically</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Check className="h-3.5 w-3.5 text-primary" />
                  <span>Detailed remediation command snippets provided for issues</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Check className="h-3.5 w-3.5 text-primary" />
                  <span>Non-intrusive logging that simplifies audit trails</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 9. Comparison Table (Light Background) */}
      <section className="py-24 bg-[#F8FAF8] border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Positioning</h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Why teams choose FlientSec
            </h3>
            <p className="text-slate-500 text-sm sm:text-base font-medium">
              A comparison showing why continuous posture checks outperform manual logs and traditional heavy lockouts.
            </p>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-premium bg-white">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-800 text-sm font-bold">
                  <th className="px-6 py-4">Capability</th>
                  <th className="px-6 py-4 text-center">Manual checklists</th>
                  <th className="px-6 py-4 text-center">Traditional MDM</th>
                  <th className="px-6 py-4 text-center text-primary bg-emerald-50/20">FlientSec</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-600">
                <tr className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-slate-800">Continuous security baseline verification</td>
                  <td className="px-6 py-4 text-center"><X className="h-5 w-5 text-red-400 mx-auto" /></td>
                  <td className="px-6 py-4 text-center"><Check className="h-5 w-5 text-success mx-auto" /></td>
                  <td className="px-6 py-4 text-center bg-emerald-50/20"><Check className="h-5 w-5 text-success mx-auto" /></td>
                </tr>
                <tr className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-slate-800">Lightweight installation without lockouts</td>
                  <td className="px-6 py-4 text-center"><X className="h-5 w-5 text-red-400 mx-auto" /></td>
                  <td className="px-6 py-4 text-center"><X className="h-5 w-5 text-red-400 mx-auto" /></td>
                  <td className="px-6 py-4 text-center bg-emerald-50/20"><Check className="h-5 w-5 text-success mx-auto" /></td>
                </tr>
                <tr className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-slate-800">Developer privacy (strictly metadata checks)</td>
                  <td className="px-6 py-4 text-center"><Check className="h-5 w-5 text-success mx-auto" /></td>
                  <td className="px-6 py-4 text-center"><X className="h-5 w-5 text-red-400 mx-auto" /></td>
                  <td className="px-6 py-4 text-center bg-emerald-50/20"><Check className="h-5 w-5 text-success mx-auto" /></td>
                </tr>
                <tr className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-slate-800">Policy rules stored as standard config code</td>
                  <td className="px-6 py-4 text-center"><X className="h-5 w-5 text-red-400 mx-auto" /></td>
                  <td className="px-6 py-4 text-center"><X className="h-5 w-5 text-red-400 mx-auto" /></td>
                  <td className="px-6 py-4 text-center bg-emerald-50/20"><Check className="h-5 w-5 text-success mx-auto" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 10. Privacy by Design (Light Background) */}
      <section className="py-24 bg-white border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Security & Trust</h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Privacy by Design
            </h3>
            <p className="text-slate-500 text-sm sm:text-base font-medium">
              We design FlientSec to respect developer boundaries. Telemetry collects security configurations, never employee activity.
            </p>
          </div>

          <div className="max-w-2xl mx-auto bg-slate-50 border border-slate-200 rounded-xl p-8 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-3 flex items-center space-x-2">
              <Lock className="h-4 w-4 text-primary" />
              <span>Developer Telemetry Boundaries</span>
            </h3>
            <ul className="space-y-4 text-sm font-semibold text-slate-700 mt-6">
              <li className="flex items-center space-x-3">
                <span className="h-5 w-5 rounded-full bg-emerald-50 text-primary flex items-center justify-center"><Check className="h-3.5 w-3.5" /></span>
                <span>No screen recording or video captures</span>
              </li>
              <li className="flex items-center space-x-3">
                <span className="h-5 w-5 rounded-full bg-emerald-50 text-primary flex items-center justify-center"><Check className="h-3.5 w-3.5" /></span>
                <span>No keystroke monitoring or input logs</span>
              </li>
              <li className="flex items-center space-x-3">
                <span className="h-5 w-5 rounded-full bg-emerald-50 text-primary flex items-center justify-center"><Check className="h-3.5 w-3.5" /></span>
                <span>No source code file scanning or repository indexing</span>
              </li>
              <li className="flex items-center space-x-3">
                <span className="h-5 w-5 rounded-full bg-emerald-50 text-primary flex items-center justify-center"><Check className="h-3.5 w-3.5" /></span>
                <span>Telemetry reports strictly limited to security configurations</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* 11. Plans Section (Light Background) */}
      <section id="plans" className="py-24 bg-[#F8FAF8] border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Deployments</h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Authentic deployment options
            </h3>
            <p className="text-slate-500 text-sm sm:text-base font-medium">
              Start with the open-source client or scale continuous validation across compliance teams.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            {/* Plan 1: Community */}
            <div className="bg-white border border-slate-200 rounded-xl p-8 flex flex-col justify-between space-y-8 shadow-sm">
              <div className="space-y-4">
                <h4 className="font-bold text-slate-800 text-lg">Community</h4>
                <p className="text-xs text-slate-400">For individual developers and open architecture teams.</p>
                <div className="pt-2 flex items-baseline">
                  <span className="text-3xl font-extrabold text-slate-900">Free</span>
                </div>
                <ul className="space-y-2.5 text-xs text-slate-600 font-medium pt-4 border-t border-slate-100">
                  <li className="flex items-center space-x-2">
                    <Check className="h-3.5 w-3.5 text-primary" />
                    <span>Up to 5 local workstations</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="h-3.5 w-3.5 text-primary" />
                    <span>Standard YAML local policy checks</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="h-3.5 w-3.5 text-primary" />
                    <span>CLI log verification</span>
                  </li>
                </ul>
              </div>
              <a 
                href="/dashboard"
                className="w-full inline-flex items-center justify-center px-4 py-2.5 border border-slate-350 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded transition-colors text-center"
              >
                Access Client Code
              </a>
            </div>

            {/* Plan 2: Design Partner */}
            <div className="bg-white border-2 border-primary rounded-xl p-8 flex flex-col justify-between space-y-8 shadow-premium relative">
              <span className="absolute top-0 right-6 transform -translate-y-1/2 bg-primary text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Active program
              </span>
              <div className="space-y-4">
                <h4 className="font-bold text-slate-900 text-lg">Design Partner</h4>
                <p className="text-xs text-slate-400 font-medium">For engineering teams building security maturity.</p>
                <div className="pt-2 flex items-baseline">
                  <span className="text-3xl font-extrabold text-slate-900">Request Access</span>
                </div>
                <ul className="space-y-2.5 text-xs text-slate-600 font-semibold pt-4 border-t border-slate-100">
                  <li className="flex items-center space-x-2">
                    <Check className="h-3.5 w-3.5 text-primary" />
                    <span>Fleet-wide central dashboard</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="h-3.5 w-3.5 text-primary" />
                    <span>Custom severity policy editor</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="h-3.5 w-3.5 text-primary" />
                    <span>Dedicated Slack channel support</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="h-3.5 w-3.5 text-primary" />
                    <span>Co-design custom checks integrations</span>
                  </li>
                </ul>
              </div>
              <a 
                href="#cta"
                className="w-full inline-flex items-center justify-center px-4 py-2.5 bg-primary hover:bg-emerald-800 text-white text-xs font-bold rounded transition-colors text-center"
              >
                Join Partner Program
              </a>
            </div>

            {/* Plan 3: Enterprise */}
            <div className="bg-white border border-slate-200 rounded-xl p-8 flex flex-col justify-between space-y-8 shadow-sm">
              <div className="space-y-4">
                <h4 className="font-bold text-slate-800 text-lg">Enterprise</h4>
                <p className="text-xs text-slate-400">For audited environments requiring strict history tracking.</p>
                <div className="pt-2 flex items-baseline">
                  <span className="text-3xl font-extrabold text-slate-900">Contact Sales</span>
                </div>
                <ul className="space-y-2.5 text-xs text-slate-600 font-medium pt-4 border-t border-slate-100">
                  <li className="flex items-center space-x-2">
                    <Check className="h-3.5 w-3.5 text-primary" />
                    <span>Unlimited connected workstations</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="h-3.5 w-3.5 text-primary" />
                    <span>Audit-history CSV records database</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="h-3.5 w-3.5 text-primary" />
                    <span>SSO / SAML User authentication</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="h-3.5 w-3.5 text-primary" />
                    <span>Custom database hosting support</span>
                  </li>
                </ul>
              </div>
              <a 
                href="#cta"
                className="w-full inline-flex items-center justify-center px-4 py-2.5 border border-slate-350 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded transition-colors text-center"
              >
                Contact Sales
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 12. FAQ Section (Light Background) */}
      <section className="py-24 bg-white border-b border-slate-200/60">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="text-center space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Frequently Asked Questions</h2>
            <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Answering key objections
            </h3>
          </div>

          <div className="divide-y divide-slate-200">
            {faqData.map((item, idx) => (
              <div key={idx} className="py-5">
                <button 
                  onClick={() => toggleFaq(idx)}
                  className="w-full flex items-center justify-between text-left font-bold text-slate-800 text-sm sm:text-base focus:outline-none"
                >
                  <span>{item.q}</span>
                  <ChevronDown className={`h-4 w-4 text-slate-400 transform transition-transform ${openFaq === idx ? "rotate-180" : "rotate-0"}`} />
                </button>
                {openFaq === idx && (
                  <p className="mt-3 text-xs sm:text-sm text-slate-500 leading-relaxed font-medium transition-all">
                    {item.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 13. Final CTA (Deep Green Background #103B33) */}
      <section id="cta" className="py-24 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-darkGreen rounded-2xl p-12 text-center text-white space-y-8 shadow-lg relative overflow-hidden">
            
            {/* Outcomes CTA copy */}
            <div className="space-y-4 relative z-10">
              <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded uppercase tracking-wider">
                Enroll Today
              </span>
              <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight pt-2">
                Start continuously verifying every workstation.
              </h2>
              <p className="text-emerald-200 text-base max-w-lg mx-auto font-medium">
                Deploy the Go agent, define your baseline policies, and know compliance levels in minutes.
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 relative z-10">
              <button 
                onClick={() => alert("Thank you for requesting early access! Our design partner coordinators will contact you.")}
                className="inline-flex items-center justify-center px-6 py-3.5 bg-primary hover:bg-emerald-800 text-white font-bold rounded-lg transition-colors shadow-sm"
              >
                Request Early Access
              </button>
              <a 
                href="/dashboard"
                className="inline-flex items-center justify-center px-6 py-3.5 border border-emerald-500/30 hover:bg-emerald-800/20 text-emerald-300 font-semibold rounded-lg transition-colors"
              >
                Access Documentation
              </a>
            </div>

            {/* Subtle bottom terminal installation command card */}
            <div className="pt-6 border-t border-emerald-900/60 max-w-sm mx-auto flex items-center justify-between font-mono text-[10px] text-emerald-300 bg-[#0d302a]/40 p-2.5 rounded-lg select-all relative z-10">
              <span>curl -fsSL https://flientsec.dev/install.sh | bash</span>
              <button 
                onClick={() => handleCopy("curl -fsSL https://flientsec.dev/install.sh | bash")}
                className="text-[9px] font-bold text-emerald-400 hover:text-emerald-250 ml-4 cursor-pointer focus:outline-none"
              >
                {copiedText ? "Copied" : "Copy"}
              </button>
            </div>

          </div>
        </div>
      </section>

      {/* 14. Enterprise Footer */}
      <footer className="border-t border-slate-200/60 bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 gap-12">
          
          {/* Logo & description column */}
          <div className="space-y-4 col-span-2 md:col-span-1">
            <div className="flex items-center space-x-2.5">
              <img src="/logo_dark.png" alt="FlientSec Logo" className="h-7 w-7 object-contain" />
              <span className="font-extrabold tracking-tight text-xl text-slate-900">FlientSec</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed font-medium">
              Continuous developer workstation security posture verification designed for modern engineering organizations.
            </p>
          </div>

          {/* Product Column */}
          <div className="space-y-3">
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-800">Product</h5>
            <ul className="space-y-2.5 text-xs font-semibold text-slate-500">
              <li><a href="#product" className="hover:text-slate-900 transition-colors">Features</a></li>
              <li><a href="#architecture" className="hover:text-slate-900 transition-colors">Architecture</a></li>
              <li><a href="#plans" className="hover:text-slate-900 transition-colors">Plans</a></li>
              <li><Link href="/dashboard" className="hover:text-slate-900 transition-colors">Demo Overview</Link></li>
            </ul>
          </div>

          {/* Resources Column */}
          <div className="space-y-3">
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-800">Resources</h5>
            <ul className="space-y-2.5 text-xs font-semibold text-slate-500">
              <li><Link href="/dashboard" className="hover:text-slate-900 transition-colors">Documentation</Link></li>
              <li><span className="text-slate-400 font-medium">Blog (Coming Soon)</span></li>
              <li><span className="text-slate-400 font-medium">Changelog</span></li>
              <li>
                <a 
                  href="https://github.com" 
                  target="_blank" 
                  rel="noreferrer" 
                  className="flex items-center space-x-1 hover:text-slate-900 transition-colors"
                >
                  <Github className="h-3.5 w-3.5" />
                  <span>GitHub Repository</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Company Column */}
          <div className="space-y-3">
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-800">Company</h5>
            <ul className="space-y-2.5 text-xs font-semibold text-slate-500">
              <li><span className="text-slate-400 font-medium">About Us</span></li>
              <li><span className="text-slate-400 font-medium">Contact Sales</span></li>
              <li><span className="text-slate-400 font-medium">Privacy Policy</span></li>
              <li><span className="text-slate-400 font-medium">Terms of Service</span></li>
            </ul>
          </div>

        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 pt-6 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 font-semibold">
          <p>© 2026 FlientSec. All rights reserved.</p>
          <div className="flex space-x-4">
            <a href="mailto:info.krishnasingh.codes@gmail.com" className="hover:text-slate-900 transition-colors">Contact</a>
            <span className="hover:text-slate-900 transition-colors">Sitemap</span>
          </div>
        </div>
      </footer>

    </div>
  )
}
