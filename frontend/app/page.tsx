"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
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
  Activity, 
  HelpCircle, 
  Layers,
  Clipboard,
  ChevronDown,
  Cpu
} from "lucide-react"

export default function LandingPage() {
  // Navigation active state inside the mock dashboard
  const [activeTab, setActiveTab] = useState<"overview" | "policies">("overview")
  
  // Interactive mock dashboard variables
  const [selectedDevice, setSelectedDevice] = useState<"macbook" | "ubuntu" | "arch">("ubuntu")
  const [firewallActive, setFirewallActive] = useState(false)
  const [recentEvents, setRecentEvents] = useState<string[]>([
    "ubuntu-laptop-02: Heartbeat received (Online)",
    "arch-workstation-03: Compliance status PASS (Score: 90)",
  ])
  const [copiedCmd, setCopiedCmd] = useState(false)
  const [copiedText, setCopiedText] = useState("")

  const ubuntuScore = firewallActive ? 85 : 45
  const ubuntuStatus = firewallActive ? "WARN" : "FAIL"

  // Trigger event log addition when firewall changes
  useEffect(() => {
    const timestamp = new Date().toLocaleTimeString()
    if (firewallActive) {
      setRecentEvents((prev: string[]) => [
        `[${timestamp}] ubuntu-laptop-02: Firewall ENABLED -> Status WARN (Score: 85)`,
        ...prev.slice(0, 3)
      ])
    } else {
      setRecentEvents((prev: string[]) => [
        `[${timestamp}] ubuntu-laptop-02: Firewall DISABLED -> Status FAIL (Score: 45)`,
        ...prev.slice(0, 3)
      ])
    }
  }, [firewallActive])

  const copyInstallerCommand = () => {
    navigator.clipboard.writeText("curl -fsSL https://flientsec.dev/install.sh | bash")
    setCopiedCmd(true)
    setTimeout(() => setCopiedCmd(false), 2000)
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedText(text)
    setTimeout(() => setCopiedText(""), 2000)
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
    <div className="bg-[#F7F9F8] text-[#6B7280] min-h-screen selection:bg-emerald-100 selection:text-emerald-900 font-sans antialiased">
      
      {/* 1. Announcement Bar */}
      <div className="bg-[#12372A] text-emerald-300 text-[10px] py-3 px-4 text-center font-bold tracking-widest uppercase z-50 relative">
        Developer Workstation Security Platform • Launching Design Partner Program
      </div>

      {/* 2. Navigation Header */}
      <header className="border-b border-slate-200/50 bg-[#F7F9F8]/95 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-10">
            <Link href="/" className="flex items-center space-x-2.5">
              <img src="/logo_dark.png" alt="FlientSec Logo" className="h-6 w-6 object-contain" />
              <span className="font-extrabold tracking-tight text-xl text-[#111827]">FlientSec</span>
            </Link>
            <nav className="hidden md:flex items-center space-x-8 text-xs font-semibold tracking-wide">
              <a href="#product" className="hover:text-[#111827] transition-colors">Product</a>
              <a href="#architecture" className="hover:text-[#111827] transition-colors">Architecture</a>
              <a href="#plans" className="hover:text-[#111827] transition-colors">Plans</a>
              <Link href="/dashboard" className="hover:text-[#111827] transition-colors">Docs</Link>
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/dashboard" className="text-xs font-semibold text-[#6B7280] hover:text-[#111827] transition-colors">
              Sign In
            </Link>
            <a 
              href="#cta" 
              className="inline-flex items-center justify-center px-4 py-2 text-xs font-bold rounded bg-[#2D8C74] hover:bg-[#12372A] text-white transition-colors"
            >
              Request Early Access
            </a>
          </div>
        </div>
      </header>

      {/* 3. Hero Section (Light Background, Whitespace Oriented) */}
      <section id="product" className="py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
          
          {/* Hero Left Column */}
          <div className="lg:col-span-5 space-y-8">
            <div className="space-y-6">
              <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-[#111827] leading-tight">
                Stop chasing compliance screenshots. <span className="text-[#2D8C74]">Know every developer workstation is secure.</span>
              </h1>
              <p className="text-base text-[#6B7280] font-normal leading-relaxed">
                FlientSec continuously verifies every engineering workstation against your organization's security baseline, so security teams always know what is compliant, what isn't, and exactly how to fix it—without deploying enterprise MDM profiles.
              </p>
            </div>

            <div className="space-y-6">
              <div className="flex flex-row items-center gap-4">
                <a 
                  href="#cta" 
                  className="inline-flex items-center justify-center px-5 py-3 bg-[#2D8C74] hover:bg-[#12372A] text-white text-xs font-bold rounded transition-colors shadow-sm"
                >
                  Request Early Access
                </a>
                <a 
                  href="/dashboard" 
                  className="inline-flex items-center justify-center px-5 py-3 border border-slate-200 hover:bg-slate-50 text-[#6B7280] text-xs font-semibold rounded transition-colors"
                >
                  See Documentation
                </a>
              </div>

              {/* Styled copyable terminal widget */}
              <div className="bg-[#111827] border border-slate-800 rounded p-2.5 max-w-sm flex items-center justify-between font-mono text-[10px]">
                <div className="flex items-center space-x-2 text-slate-400 select-all overflow-hidden truncate mr-4">
                  <span className="text-emerald-500 font-bold">$</span>
                  <span className="truncate text-slate-350">curl -fsSL https://flientsec.dev/install.sh | bash</span>
                </div>
                <button 
                  onClick={copyInstallerCommand}
                  className="flex-shrink-0 p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                  title="Copy command"
                >
                  {copiedCmd ? <span className="text-[9px] text-emerald-400 font-bold">Copied!</span> : <Clipboard className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Hero Right Column - Fully-Fledged Interactive SaaS Dashboard Mockup */}
          <div className="lg:col-span-7">
            <div className="bg-white border border-slate-200 rounded shadow-premium overflow-hidden font-sans flex h-[460px] w-full">
              
              {/* Sidebar Panel */}
              <div className="w-40 bg-[#111827] text-slate-300 p-4 border-r border-slate-800 flex flex-col justify-between flex-shrink-0 text-[10px] font-semibold">
                <div className="space-y-6">
                  {/* Brand header */}
                  <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
                    <img src="/logo_light.png" alt="Logo" className="h-4.5 w-4.5 object-contain" />
                    <span className="font-extrabold tracking-tight text-xs text-white">FlientSec</span>
                  </div>

                  {/* Sidebar Items */}
                  <div className="space-y-1">
                    <button 
                      onClick={() => setActiveTab("overview")}
                      className={`w-full flex items-center space-x-2 px-2 py-1.5 rounded transition-colors text-left ${activeTab === "overview" ? "bg-slate-800 text-white" : "hover:bg-slate-800/50 hover:text-white"}`}
                    >
                      <Layers className="h-3 w-3" />
                      <span>Overview</span>
                    </button>
                    <button 
                      onClick={() => setActiveTab("policies")}
                      className={`w-full flex items-center space-x-2 px-2 py-1.5 rounded transition-colors text-left ${activeTab === "policies" ? "bg-slate-800 text-white" : "hover:bg-slate-800/50 hover:text-white"}`}
                    >
                      <Code className="h-3 w-3" />
                      <span>Policies</span>
                    </button>
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-3 flex items-center space-x-2 truncate">
                  <div className="h-5 w-5 rounded-full bg-[#2D8C74] flex items-center justify-center text-[8px] font-bold text-white">AD</div>
                  <div className="truncate">
                    <p className="text-[9px] text-white leading-none">admin@flientsec.local</p>
                  </div>
                </div>
              </div>

              {/* Main Panel Header & View Split */}
              <div className="flex-1 bg-[#F7F9F8] flex flex-col overflow-hidden text-[10px] text-[#6B7280]">
                
                {/* Internal Mock Header */}
                <div className="h-10 border-b border-slate-200 bg-white px-4 flex items-center justify-between flex-shrink-0">
                  <span className="font-bold text-[#111827]">
                    {activeTab === "overview" ? "Workstation Fleet Security" : "YAML Security baseline rules"}
                  </span>
                  <span className="text-[9px] border border-slate-200 px-1.5 py-0.5 rounded bg-[#F7F9F8] font-bold text-[#6B7280]">
                    Default Org
                  </span>
                </div>

                {/* View Container */}
                <div className="flex-1 overflow-hidden">
                  {activeTab === "overview" ? (
                    // Dual Pane Layout inside Overview: Left Device list, Right Inspector
                    <div className="flex h-full divide-x divide-slate-200">
                      
                      {/* Left Pane: Device Table */}
                      <div className="w-1/2 bg-white overflow-y-auto divide-y divide-slate-100">
                        {/* Device row 1: macbook */}
                        <button 
                          onClick={() => setSelectedDevice("macbook")}
                          className={`w-full p-2.5 text-left flex flex-col space-y-1 transition-colors ${selectedDevice === "macbook" ? "bg-[#F7F9F8]" : "hover:bg-slate-50"}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[#111827] truncate">macbook-pro-01</span>
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                          </div>
                          <div className="flex justify-between items-center text-[9px]">
                            <span className="text-emerald-600 bg-emerald-50 px-1 rounded font-bold">PASS (100)</span>
                            <span className="text-[#6B7280] font-mono">macOS</span>
                          </div>
                        </button>

                        {/* Device row 2: ubuntu */}
                        <button 
                          onClick={() => setSelectedDevice("ubuntu")}
                          className={`w-full p-2.5 text-left flex flex-col space-y-1 transition-colors ${selectedDevice === "ubuntu" ? "bg-[#F7F9F8]" : "hover:bg-slate-50"}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[#111827] truncate text-slate-900">ubuntu-laptop-02</span>
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                          </div>
                          <div className="flex justify-between items-center text-[9px]">
                            <span className={`px-1 rounded font-bold ${
                              firewallActive ? "text-amber-600 bg-amber-50" : "text-rose-500 bg-rose-50"
                            }`}>
                              {ubuntuStatus} ({ubuntuScore})
                            </span>
                            <span className="text-[#6B7280] font-mono">Ubuntu</span>
                          </div>
                        </button>

                        {/* Device row 3: arch */}
                        <button 
                          onClick={() => setSelectedDevice("arch")}
                          className={`w-full p-2.5 text-left flex flex-col space-y-1 transition-colors ${selectedDevice === "arch" ? "bg-[#F7F9F8]" : "hover:bg-slate-50"}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[#111827] truncate">arch-workstation-03</span>
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-350"></span>
                          </div>
                          <div className="flex justify-between items-center text-[9px]">
                            <span className="text-emerald-600 bg-emerald-50 px-1 rounded font-bold">PASS (90)</span>
                            <span className="text-[#6B7280] font-mono">Arch Linux</span>
                          </div>
                        </button>
                      </div>

                      {/* Right Pane: Inspector Panel */}
                      <div className="w-1/2 p-3 overflow-y-auto space-y-3 bg-[#F7F9F8]">
                        {selectedDevice === "macbook" && (
                          <div className="space-y-2">
                            <h4 className="font-bold text-[#111827]">macbook-pro-01</h4>
                            <p className="text-[9px] text-[#6B7280]">macOS 14.2.1 • M2 Max</p>
                            <div className="border border-slate-200/50 rounded bg-white p-2 space-y-1.5 font-mono text-[9px]">
                              <div className="flex items-center justify-between text-emerald-600 font-bold">
                                <span>Disk Encryption File Vault</span>
                                <span>PASS</span>
                              </div>
                              <div className="flex items-center justify-between text-emerald-600 font-bold">
                                <span>Gatekeeper Protection</span>
                                <span>PASS</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {selectedDevice === "ubuntu" && (
                          <div className="space-y-3">
                            <div>
                              <h4 className="font-bold text-[#111827] text-xs">ubuntu-laptop-02</h4>
                              <p className="text-[8px] text-[#6B7280] mt-0.5">Ubuntu 22.04 LTS • Kernel 5.15</p>
                            </div>

                            {/* Compliance checks checklist with interactive switch */}
                            <div className="space-y-1.5">
                              {/* Firewall check row */}
                              <div className="border border-slate-200/50 rounded bg-white p-2 flex items-center justify-between font-mono text-[9px]">
                                <div className="flex items-center space-x-1.5">
                                  {firewallActive ? <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> : <ShieldAlert className="h-3.5 w-3.5 text-rose-500" />}
                                  <span className="font-bold text-[#111827]">UFW Firewall</span>
                                </div>
                                <button 
                                  onClick={() => setFirewallActive(!firewallActive)}
                                  className={`w-7 h-3.5 rounded-full p-0.5 transition-colors focus:outline-none ${firewallActive ? "bg-[#2D8C74]" : "bg-slate-300"}`}
                                >
                                  <div className={`bg-white w-2.5 h-2.5 rounded-full shadow-sm transform transition-transform ${firewallActive ? "translate-x-3.5" : "translate-x-0"}`}></div>
                                </button>
                              </div>

                              {/* Disk encryption check row */}
                              <div className="border border-slate-200/50 rounded bg-white p-2 flex items-center justify-between font-mono text-[9px]">
                                <div className="flex items-center space-x-1.5">
                                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                                  <span className="font-bold text-[#111827]">Disk Encrypted</span>
                                </div>
                                <span className="text-emerald-600 font-bold">PASS</span>
                              </div>

                              {/* Packages updates warning check row */}
                              <div className="border border-slate-200/50 rounded bg-white p-2 flex items-center justify-between font-mono text-[9px]">
                                <div className="flex items-center space-x-1.5">
                                  <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
                                  <span className="font-bold text-[#111827]">Pending Updates</span>
                                </div>
                                <span className="text-amber-600 font-bold">WARN (21)</span>
                              </div>
                            </div>

                            {/* Telemetry live feed log inside inspector */}
                            <div className="bg-slate-900 text-slate-350 rounded p-2 font-mono text-[8px] space-y-1 border border-slate-800">
                              <p className="text-slate-500 uppercase tracking-widest font-bold">Events</p>
                              {recentEvents.map((evt: string, idx: number) => (
                                <p key={idx} className="truncate">
                                  <span className="text-slate-500">&gt;</span> {evt}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}

                        {selectedDevice === "arch" && (
                          <div className="space-y-2">
                            <h4 className="font-bold text-[#111827]">arch-workstation-03</h4>
                            <p className="text-[9px] text-[#6B7280]">Arch Linux • Kernel 6.9.1</p>
                            <div className="border border-slate-200/50 rounded bg-white p-2 space-y-1.5 font-mono text-[9px]">
                              <div className="flex items-center justify-between text-emerald-600 font-bold">
                                <span>Pacman Baseline</span>
                                <span>PASS</span>
                              </div>
                              <div className="flex items-center justify-between text-emerald-600 font-bold">
                                <span>Root Access Config</span>
                                <span>PASS</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                    </div>
                  ) : (
                    // YAML Rules editor tab view
                    <div className="p-4 h-full bg-slate-950 font-mono text-[9px] text-slate-300 overflow-y-auto leading-relaxed select-all">
                      <p className="text-slate-500"># Config sync settings</p>
                      <p className="text-teal-400">rules:</p>
                      <p className="pl-4 text-teal-400">firewall:</p>
                      <p className="pl-8"><span className="text-slate-400">required:</span> true</p>
                      <p className="pl-8"><span className="text-slate-400">severity:</span> high</p>
                      <p className="pl-4 text-teal-400">disk_encryption:</p>
                      <p className="pl-8"><span className="text-slate-400">required:</span> true</p>
                      <p className="pl-8"><span className="text-slate-400">severity:</span> high</p>
                    </div>
                  )}
                </div>

              </div>

            </div>
          </div>

        </div>
      </section>

      {/* 4. Trust Badges Strip (Light Background) */}
      <section className="py-10 border-y border-slate-200/50 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-[9px] font-bold text-[#6B7280] uppercase tracking-widest mb-6">
            Designed for Linux Engineering Teams • Open Architecture • Privacy by Design
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center text-xs font-semibold text-[#111827]">
            <div>Linux Native</div>
            <div>Policy as Code</div>
            <div>Privacy First</div>
            <div>Real-Time Verification</div>
          </div>
        </div>
      </section>

      {/* 5. Why FlientSec Exists */}
      <section className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 text-center">
          <span className="text-[10px] font-bold tracking-widest text-[#2D8C74] uppercase">
            Platform Vision
          </span>
          <h2 className="text-3xl font-extrabold text-[#111827] tracking-tight leading-tight">
            Why FlientSec Exists
          </h2>
          <p className="text-[#6B7280] text-sm leading-relaxed max-w-2xl mx-auto font-medium">
            Engineering organizations increasingly need to demonstrate security maturity to enterprise customers. Yet verifying developer workstations is still a manual process involving screenshots, spreadsheets, and periodic audits. FlientSec replaces that workflow with continuous, policy-driven verification designed for modern engineering teams.
          </p>
        </div>
      </section>

      {/* 6. Problem Section (Deep Green Background #12372A, Infographic Style, No Card Outlines) */}
      <section className="py-28 bg-[#12372A] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
            <span className="text-[10px] font-bold tracking-widest text-emerald-300 uppercase">
              The Problem
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              Chasing screenshots belongs in the past
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 max-w-4xl mx-auto items-start">
            
            {/* Manual Audit Pipeline */}
            <div className="space-y-6">
              <span className="text-[10px] font-bold text-rose-300 uppercase tracking-widest">Manual Audits</span>
              <p className="text-xs text-emerald-100/60 leading-relaxed font-semibold">
                IT departments chasing engineers over slack to grab screenshots of configuration properties.
              </p>
              
              {/* Infographic Steps */}
              <div className="space-y-3 font-mono text-[10px] text-rose-300 font-bold">
                <div className="flex items-center space-x-2"><span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span><span>1. Send Slack compliance message</span></div>
                <div className="flex items-center space-x-2"><span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span><span>2. Developer captures workstation screenshot</span></div>
                <div className="flex items-center space-x-2"><span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span><span>3. Upload screen file to spreadsheet</span></div>
                <div className="flex items-center space-x-2"><span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span><span>4. Auditor inspects logs manually</span></div>
              </div>
              <div className="pt-4 border-t border-emerald-900/60 font-mono text-xs font-bold text-rose-400">
                Hours of manual verification
              </div>
            </div>

            {/* Continuous Posture Pipeline */}
            <div className="space-y-6">
              <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest">FlientSec</span>
              <p className="text-xs text-emerald-100/75 leading-relaxed font-semibold">
                Always-active background client evaluating rules locally on workstations and reporting telemetry automatically.
              </p>

              {/* Infographic Steps */}
              <div className="space-y-3 font-mono text-[10px] text-emerald-300 font-bold">
                <div className="flex items-center space-x-2"><span className="h-1.5 w-1.5 rounded-full bg-[#2D8C74]"></span><span>1. Run Go verification agent locally</span></div>
                <div className="flex items-center space-x-2"><span className="h-1.5 w-1.5 rounded-full bg-[#2D8C74]"></span><span>2. Evaluate policy configurations against YAML rules</span></div>
                <div className="flex items-center space-x-2"><span className="h-1.5 w-1.5 rounded-full bg-[#2D8C74]"></span><span>3. Securely transmit check-in telemetry</span></div>
                <div className="flex items-center space-x-2"><span className="h-1.5 w-1.5 rounded-full bg-[#2D8C74]"></span><span>4. Evidence reports automatically audit-ready</span></div>
              </div>
              <div className="pt-4 border-t border-emerald-900/60 font-mono text-xs font-bold text-emerald-300">
                Automated verification
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 7. Technical Proof Section [NEW] (YAML rule schema evaluation demonstration) */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="text-[10px] font-bold tracking-widest text-[#2D8C74] uppercase">Technical Proof</span>
            <h3 className="text-3xl font-extrabold text-[#111827] tracking-tight">
              Define a policy once. Verify every workstation.
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-4xl mx-auto">
            {/* Left: YAML Policy schema */}
            <div className="bg-[#111827] text-slate-350 rounded p-5 font-mono text-[10px] leading-relaxed shadow-lg">
              <p className="text-slate-500"># policy.yaml configuration</p>
              <p className="text-teal-400">checks:</p>
              <p className="pl-4 text-teal-400">firewall:</p>
              <p className="pl-8"><span className="text-slate-400">required:</span> true</p>
              <p className="pl-8"><span className="text-slate-400">severity:</span> high</p>
              <p className="pl-4 text-teal-400">disk_encryption:</p>
              <p className="pl-8"><span className="text-slate-400">required:</span> true</p>
              <p className="pl-8"><span className="text-slate-400">severity:</span> high</p>
              <p className="pl-4 text-teal-400">kernel_updates:</p>
              <p className="pl-8"><span className="text-slate-400">max_age:</span> 7</p>
              <p className="pl-8"><span className="text-slate-400">severity:</span> medium</p>
            </div>

            {/* Right: Evaluation panel mockup */}
            <div className="bg-[#F7F9F8] border border-slate-200 rounded p-6 flex flex-col justify-center space-y-4">
              <h4 className="font-bold text-[#111827] text-xs">Evaluation Results</h4>
              <div className="space-y-2 text-[10px] font-mono">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="font-semibold text-slate-800">Firewall Ruleset check</span>
                  <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-bold">PASS</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="font-semibold text-slate-800">Disk encryption check</span>
                  <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-bold">PASS</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">Kernel update delay</span>
                  <span className="text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-bold">WARN (9 days)</span>
                </div>
              </div>
              <p className="text-[9px] text-[#6B7280] leading-relaxed pt-2">
                Evaluator scans local system properties, runs baseline comparisons, and emits formatted compliance metrics immediately.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Who is FlientSec NOT for? Box */}
      <section className="py-12 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="border border-slate-250 border-slate-200 bg-[#F7F9F8] rounded p-6 space-y-4">
            <h4 className="font-bold text-[#111827] text-xs uppercase tracking-wide">Who is FlientSec NOT for?</h4>
            <p className="text-xs text-[#6B7280] leading-relaxed font-medium">
              FlientSec is built for engineering organizations that need continuous workstation security verification. It is **not** a Mobile Device Management (MDM) platform, employee activity monitoring surveillance tool, or endpoint antivirus scanner.
            </p>
          </div>
        </div>
      </section>

      {/* 9. Technical Architecture Section (Light Background, Animated packet SVG) */}
      <section id="architecture" className="py-24 bg-white border-t border-slate-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="text-[10px] font-bold tracking-widest text-[#2D8C74] uppercase">Engineering Specs</span>
            <h3 className="text-3xl font-extrabold text-[#111827] tracking-tight">
              Symmetric local policy evaluation
            </h3>
            <p className="text-sm text-[#6B7280] font-medium leading-relaxed max-w-2xl mx-auto">
              All policy rules are evaluated locally on developer laptops. The Go client collects configuration properties without transmitting source code or user activities.
            </p>
          </div>

          <div className="max-w-4xl mx-auto relative border border-slate-200 bg-[#F7F9F8]/50 rounded-lg p-6 shadow-sm flex flex-col md:flex-row items-center gap-8">
            
            {/* SVG Diagram Grid with simple CSS keyframe animation */}
            <div className="flex-1 w-full flex justify-center">
              <svg 
                viewBox="0 0 700 200" 
                className="w-full max-w-xl font-mono text-[9px]" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Node Box outlines */}
                <rect x="5" y="60" width="110" height="70" rx="4" fill="white" stroke="#E2E8F0" strokeWidth="2" />
                <rect x="170" y="60" width="110" height="70" rx="4" fill="white" stroke="#E2E8F0" strokeWidth="2" />
                <rect x="340" y="60" width="120" height="70" rx="4" fill="#12372A" stroke="#12372A" strokeWidth="2" />
                <rect x="520" y="60" width="110" height="70" rx="4" fill="white" stroke="#E2E8F0" strokeWidth="2" />

                {/* Flow lines */}
                <path d="M 115 95 L 170 95" stroke="#CBD5E1" strokeWidth="1.5" markerEnd="url(#flow-arrow)" />
                <path d="M 280 95 L 340 95" stroke="#CBD5E1" strokeWidth="1.5" markerEnd="url(#flow-arrow)" />
                <path d="M 460 95 L 520 95" stroke="#CBD5E1" strokeWidth="1.5" markerEnd="url(#flow-arrow)" />

                {/* Animated Packet circle */}
                <circle cx="280" cy="95" r="4" fill="#2D8C74">
                  <animate 
                    attributeName="cx" 
                    values="280;340" 
                    dur="2.5s" 
                    repeatCount="indefinite" 
                  />
                  <animate 
                    attributeName="opacity" 
                    values="0;1;0" 
                    dur="2.5s" 
                    repeatCount="indefinite" 
                  />
                </circle>

                {/* Node Texts */}
                <text x="60" y="90" textAnchor="middle" fill="#111827" fontWeight="bold">Workstation</text>
                <text x="60" y="105" textAnchor="middle" fill="#6B7280" fontSize="8">Ubuntu/Arch</text>

                <text x="225" y="90" textAnchor="middle" fill="#111827" fontWeight="bold">Go Agent</text>
                <text x="225" y="105" textAnchor="middle" fill="#6B7280" fontSize="8">Local Eval</text>

                <text x="400" y="90" textAnchor="middle" fill="#2D8C74" fontWeight="bold">Secure API</text>
                <text x="400" y="105" textAnchor="middle" fill="white" fontSize="8">HTTPS</text>

                <text x="575" y="90" textAnchor="middle" fill="#111827" fontWeight="bold">Dashboard</text>
                <text x="575" y="105" textAnchor="middle" fill="#6B7280" fontSize="8">Posture Trail</text>

                {/* Highlight local boundary box */}
                <rect x="2" y="25" width="286" height="120" rx="8" stroke="#2D8C74" strokeWidth="1.5" strokeDasharray="5 3" fill="none" />
                <text x="145" y="18" textAnchor="middle" fill="#2D8C74" fontWeight="bold" fontSize="8">Local Verification Boundary</text>

                <defs>
                  <marker id="flow-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#CBD5E1" />
                  </marker>
                </defs>
              </svg>
            </div>

            {/* Local Callout */}
            <div className="w-full md:w-64 flex-shrink-0">
              <div className="p-4 border-2 border-emerald-500/10 bg-emerald-500/5 rounded">
                <h4 className="font-bold text-[#111827] text-xs flex items-center space-x-1.5">
                  <ShieldCheck className="h-4 w-4 text-[#2D8C74]" />
                  <span>Privacy guarantee</span>
                </h4>
                <p className="text-[10px] text-[#6B7280] mt-2 font-medium leading-relaxed">
                  All checks execute locally on the workstation. Telemetry payloads strictly communicate configurations, not source files or activity.
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 10. Feature Cards (Varied Visual Rhythm - Removed component library look) */}
      <section className="py-24 bg-[#F7F9F8] border-t border-slate-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="text-[10px] font-bold tracking-widest text-[#2D8C74] uppercase">Capabilities</span>
            <h3 className="text-3xl font-extrabold text-[#111827] tracking-tight">
              Workstation security verification, automated
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-5xl mx-auto">
            
            {/* Card 1: Checklist format */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Cpu className="h-4 w-4 text-[#2D8C74]" />
                <h4 className="text-base font-bold text-[#111827]">Continuous Verification</h4>
              </div>
              <p className="text-xs text-[#6B7280] leading-relaxed font-medium">
                Verify system security baselines continuously in the background.
              </p>
              <div className="space-y-2 text-xs font-semibold text-[#111827] pt-2 border-t border-slate-200/60">
                <div className="flex items-center space-x-2">
                  <Check className="h-4 w-4 text-emerald-600" />
                  <span>✓ Firewall status (UFW, firewalld, iptables)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="h-4 w-4 text-emerald-600" />
                  <span>✓ Disk encryption mount analysis (lsblk)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="h-4 w-4 text-emerald-600" />
                  <span>✓ Package manager upgrade registers</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="h-4 w-4 text-emerald-600" />
                  <span>✓ Local compiler compiler runtime environment versions</span>
                </div>
              </div>
            </div>

            {/* Card 2: Diagram layout */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Code className="h-4 w-4 text-[#2D8C74]" />
                <h4 className="text-base font-bold text-[#111827]">Policy as Code</h4>
              </div>
              <p className="text-xs text-[#6B7280] leading-relaxed font-medium">
                Define rulesets in a single git-controlled YAML configuration.
              </p>
              <div className="pt-4 border-t border-slate-200/60 flex items-center justify-between font-mono text-[9px] text-[#6B7280]">
                <div className="space-y-1.5">
                  <p className="font-bold text-[#111827]">policy.yaml</p>
                  <p>firewall: required: true</p>
                  <p>disk_encryption: true</p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-350" />
                <div className="space-y-1 bg-emerald-50 text-emerald-800 p-2 rounded">
                  <p className="font-bold">Evaluation Result</p>
                  <p>✔ Compliant (100)</p>
                </div>
              </div>
            </div>

            {/* Card 3: Spreadsheet mockup */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Activity className="h-4 w-4 text-[#2D8C74]" />
                <h4 className="text-base font-bold text-[#111827]">Fleet Health Overview</h4>
              </div>
              <p className="text-xs text-[#6B7280] leading-relaxed font-medium">
                Get instant visibility into overall workstation compliance levels.
              </p>
              <div className="border border-slate-200 bg-white rounded overflow-hidden font-mono text-[8px] leading-none">
                <div className="bg-slate-50 p-2 border-b border-slate-200 flex justify-between font-bold text-[#111827]">
                  <span>Device</span>
                  <span>Compliance score</span>
                </div>
                <div className="p-2 flex justify-between">
                  <span>dev-laptop-01</span>
                  <span className="text-emerald-600 font-bold">100 (PASS)</span>
                </div>
                <div className="p-2 flex justify-between border-t border-slate-100">
                  <span>dev-laptop-02</span>
                  <span className="text-rose-500 font-bold">45 (FAIL)</span>
                </div>
              </div>
            </div>

            {/* Card 4: Timeline format */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-[#2D8C74]" />
                <h4 className="text-base font-bold text-[#111827]">Audit Evidence Logs</h4>
              </div>
              <p className="text-xs text-[#6B7280] leading-relaxed font-medium">
                Generate compliance documentation ready to pass security audits.
              </p>
              <div className="space-y-2 border-l-2 border-slate-200 pl-4 text-[9px] font-mono">
                <div>
                  <p className="font-bold text-[#111827]">09:00 AM</p>
                  <p className="text-[#6B7280]">Agent checks completed locally</p>
                </div>
                <div>
                  <p className="font-bold text-[#111827]">09:02 AM</p>
                  <p className="text-[#6B7280]">Telemetry exported securely</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 11. Comparison Table (Light Background, Differentiator row) */}
      <section className="py-24 bg-white border-t border-slate-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="text-[10px] font-bold tracking-widest text-[#2D8C74] uppercase">Positioning</span>
            <h3 className="text-3xl font-extrabold text-[#111827] tracking-tight">
              Why teams choose FlientSec
            </h3>
          </div>

          <div className="border border-slate-200 rounded overflow-hidden shadow-sm bg-white max-w-4xl mx-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[#111827] text-[10px] font-bold uppercase tracking-wider">
                  <th className="px-6 py-4">Capability</th>
                  <th className="px-6 py-4 text-center">Manual checklists</th>
                  <th className="px-6 py-4 text-center">Traditional MDM</th>
                  <th className="px-6 py-4 text-center text-[#2D8C74] bg-emerald-50/20">FlientSec</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-[#6B7280] font-medium">
                <tr className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-[#111827]">Linux Native Support</td>
                  <td className="px-6 py-4 text-center"><X className="h-4 w-4 text-rose-400 mx-auto" /></td>
                  <td className="px-6 py-4 text-center"><X className="h-4 w-4 text-rose-400 mx-auto" /></td>
                  <td className="px-6 py-4 text-center bg-emerald-50/20"><Check className="h-4 w-4 text-[#2D8C74] mx-auto" /></td>
                </tr>
                <tr className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-[#111827]">Continuous security baseline verification</td>
                  <td className="px-6 py-4 text-center"><X className="h-4 w-4 text-rose-400 mx-auto" /></td>
                  <td className="px-6 py-4 text-center"><Check className="h-4 w-4 text-emerald-600 mx-auto" /></td>
                  <td className="px-6 py-4 text-center bg-emerald-50/20"><Check className="h-4 w-4 text-[#2D8C74] mx-auto" /></td>
                </tr>
                <tr className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-[#111827]">Lightweight installation without lockouts</td>
                  <td className="px-6 py-4 text-center"><X className="h-4 w-4 text-rose-400 mx-auto" /></td>
                  <td className="px-6 py-4 text-center"><X className="h-4 w-4 text-rose-400 mx-auto" /></td>
                  <td className="px-6 py-4 text-center bg-emerald-50/20"><Check className="h-4 w-4 text-[#2D8C74] mx-auto" /></td>
                </tr>
                <tr className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-[#111827]">Developer privacy (strictly metadata checks)</td>
                  <td className="px-6 py-4 text-center"><Check className="h-4 w-4 text-emerald-600 mx-auto" /></td>
                  <td className="px-6 py-4 text-center"><X className="h-4 w-4 text-rose-400 mx-auto" /></td>
                  <td className="px-6 py-4 text-center bg-emerald-50/20"><Check className="h-4 w-4 text-[#2D8C74] mx-auto" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 12. Privacy by Design */}
      <section className="py-24 bg-white border-t border-slate-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="text-[10px] font-bold tracking-widest text-[#2D8C74] uppercase">Trust Boundaries</span>
            <h3 className="text-3xl font-extrabold text-[#111827] tracking-tight">
              Privacy by Design
            </h3>
          </div>

          <div className="max-w-xl mx-auto bg-[#F7F9F8] border border-slate-200 rounded p-6 shadow-sm">
            <h3 className="text-xs font-bold text-[#111827] border-b border-slate-200 pb-3 flex items-center space-x-2">
              <Lock className="h-4 w-4 text-[#2D8C74]" />
              <span>Developer Telemetry Boundaries</span>
            </h3>
            <ul className="space-y-4 text-xs font-semibold text-slate-700 mt-6">
              <li className="flex items-center space-x-3">
                <span className="h-5 w-5 rounded-full bg-emerald-50 text-[#2D8C74] flex items-center justify-center"><Check className="h-3 w-3" /></span>
                <span>No screen recording or video captures</span>
              </li>
              <li className="flex items-center space-x-3">
                <span className="h-5 w-5 rounded-full bg-emerald-50 text-[#2D8C74] flex items-center justify-center"><Check className="h-3 w-3" /></span>
                <span>No keystroke monitoring or input logs</span>
              </li>
              <li className="flex items-center space-x-3">
                <span className="h-5 w-5 rounded-full bg-emerald-50 text-[#2D8C74] flex items-center justify-center"><Check className="h-3 w-3" /></span>
                <span>No source code file scanning or repository indexing</span>
              </li>
              <li className="flex items-center space-x-3">
                <span className="h-5 w-5 rounded-full bg-emerald-50 text-[#2D8C74] flex items-center justify-center"><Check className="h-3 w-3" /></span>
                <span>Telemetry reports strictly limited to security configurations</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* 13. Plans Section (Deployment options) */}
      <section id="plans" className="py-24 bg-[#F7F9F8] border-t border-slate-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="text-[10px] font-bold tracking-widest text-[#2D8C74] uppercase">Deployments</span>
            <h3 className="text-3xl font-extrabold text-[#111827] tracking-tight">
              Deployment options
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch max-w-5xl mx-auto">
            {/* Plan 1: Community */}
            <div className="bg-white border border-slate-200 rounded p-6 flex flex-col justify-between space-y-8 shadow-sm">
              <div className="space-y-4">
                <h4 className="font-bold text-[#111827] text-sm">Community</h4>
                <p className="text-[10px] text-[#6B7280]">For individual developers and open architecture teams.</p>
                <div className="pt-2">
                  <span className="text-2xl font-black text-[#111827]">Free</span>
                </div>
                <ul className="space-y-2 text-xs font-semibold text-slate-700 pt-4 border-t border-slate-100">
                  <li className="flex items-center space-x-2">
                    <Check className="h-3 w-3 text-[#2D8C74]" />
                    <span>Up to 5 workstations</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="h-3 w-3 text-[#2D8C74]" />
                    <span>Standard YAML local policy checks</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="h-3 w-3 text-[#2D8C74]" />
                    <span>CLI log verification</span>
                  </li>
                </ul>
              </div>
              <a 
                href="/dashboard"
                className="w-full inline-flex items-center justify-center px-4 py-2 border border-slate-200 hover:bg-slate-50 text-[#6B7280] text-xs font-bold rounded transition-colors text-center"
              >
                Access Client Code
              </a>
            </div>

            {/* Plan 2: Design Partner */}
            <div className="bg-white border border-[#2D8C74] rounded p-6 flex flex-col justify-between space-y-8 shadow-sm relative">
              <span className="absolute top-0 right-6 transform -translate-y-1/2 bg-[#2D8C74] text-white text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Active program
              </span>
              <div className="space-y-4">
                <h4 className="font-bold text-[#111827] text-sm">Design Partner</h4>
                <p className="text-[10px] text-[#6B7280]">For engineering teams building security maturity.</p>
                <div className="pt-2">
                  <span className="text-2xl font-black text-[#111827]">Request Access</span>
                </div>
                <ul className="space-y-2 text-xs font-semibold text-slate-700 pt-4 border-t border-slate-100">
                  <li className="flex items-center space-x-2">
                    <Check className="h-3 w-3 text-[#2D8C74]" />
                    <span>Fleet-wide central dashboard</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="h-3 w-3 text-[#2D8C74]" />
                    <span>Custom severity policy editor</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="h-3 w-3 text-[#2D8C74]" />
                    <span>Dedicated Slack channel support</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="h-3 w-3 text-[#2D8C74]" />
                    <span>Co-design custom checks</span>
                  </li>
                </ul>
              </div>
              <a 
                href="#cta"
                className="w-full inline-flex items-center justify-center px-4 py-2 bg-[#2D8C74] hover:bg-[#12372A] text-white text-xs font-bold rounded transition-colors text-center"
              >
                Join Partner Program
              </a>
            </div>

            {/* Plan 3: Enterprise */}
            <div className="bg-white border border-slate-200 rounded p-6 flex flex-col justify-between space-y-8 shadow-sm">
              <div className="space-y-4">
                <h4 className="font-bold text-[#111827] text-sm">Enterprise</h4>
                <p className="text-[10px] text-[#6B7280]">For audited environments requiring strict history tracking.</p>
                <div className="pt-2">
                  <span className="text-2xl font-black text-[#111827]">Contact Sales</span>
                </div>
                <ul className="space-y-2 text-xs font-semibold text-slate-700 pt-4 border-t border-slate-100">
                  <li className="flex items-center space-x-2">
                    <Check className="h-3 w-3 text-[#2D8C74]" />
                    <span>Unlimited connected workstations</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="h-3 w-3 text-[#2D8C74]" />
                    <span>Audit-history CSV records database</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="h-3 w-3 text-[#2D8C74]" />
                    <span>SSO / SAML User authentication</span>
                  </li>
                </ul>
              </div>
              <a 
                href="#cta"
                className="w-full inline-flex items-center justify-center px-4 py-2 border border-slate-200 hover:bg-slate-50 text-[#6B7280] text-xs font-bold rounded transition-colors text-center"
              >
                Contact Sales
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 14. FAQ Section (Light Background) */}
      <section className="py-24 bg-white border-t border-slate-200/50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="text-center space-y-4">
            <span className="text-[10px] font-bold tracking-widest text-[#2D8C74] uppercase">Common Objections</span>
            <h3 className="text-3xl font-extrabold text-[#111827] tracking-tight">
              Frequently Asked Questions
            </h3>
          </div>

          <div className="divide-y divide-slate-200">
            {faqData.map((item, idx) => (
              <div key={idx} className="py-5">
                <button 
                  onClick={() => toggleFaq(idx)}
                  className="w-full flex items-center justify-between text-left font-bold text-[#111827] text-sm sm:text-base focus:outline-none"
                >
                  <span>{item.q}</span>
                  <ChevronDown className={`h-4 w-4 text-slate-400 transform transition-transform ${openFaq === idx ? "rotate-180" : "rotate-0"}`} />
                </button>
                {openFaq === idx && (
                  <p className="mt-3 text-xs sm:text-sm text-[#6B7280] leading-relaxed font-medium transition-all">
                    {item.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 15. Final CTA (Deep Green Background #12372A) */}
      <section id="cta" className="py-24 bg-white border-t border-slate-200/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-[#12372A] rounded p-12 text-center text-white space-y-8 shadow-lg relative overflow-hidden">
            
            <div className="space-y-4 relative z-10">
              <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest">
                Enroll Today
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight pt-2">
                Start continuously verifying every workstation.
              </h2>
              <p className="text-emerald-200/70 text-xs sm:text-sm max-w-md mx-auto font-semibold leading-relaxed">
                Deploy the Go agent, define your baseline policies, and know compliance levels in minutes.
              </p>
            </div>

            <div className="flex flex-row items-center justify-center gap-4 relative z-10">
              <button 
                onClick={() => alert("Thank you for requesting early access! Our design partner coordinators will contact you.")}
                className="inline-flex items-center justify-center px-5 py-3 bg-[#2D8C74] hover:bg-emerald-800 text-white text-xs font-bold rounded transition-colors shadow-sm"
              >
                Request Early Access
              </button>
              <a 
                href="/dashboard"
                className="inline-flex items-center justify-center px-5 py-3 border border-emerald-500/30 hover:bg-emerald-800/20 text-emerald-300 text-xs font-semibold rounded transition-colors"
              >
                Access Documentation
              </a>
            </div>

            {/* Subtle bottom terminal installation command card */}
            <div className="pt-6 border-t border-emerald-900/60 max-w-sm mx-auto flex items-center justify-between font-mono text-[9px] text-emerald-300 bg-[#0d302a]/40 p-2 rounded select-all relative z-10">
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

      {/* 16. Minimalist Footer */}
      <footer className="border-t border-slate-200/50 bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 gap-12">
          
          <div className="space-y-4 col-span-2 md:col-span-1">
            <div className="flex items-center space-x-2">
              <img src="/logo_dark.png" alt="FlientSec Logo" className="h-6 w-6 object-contain" />
              <span className="font-extrabold tracking-tight text-base text-[#111827]">FlientSec</span>
            </div>
          </div>

          {/* Product Column */}
          <div className="space-y-3">
            <h5 className="text-[10px] font-bold uppercase tracking-wider text-[#111827]">Product</h5>
            <ul className="space-y-2.5 text-xs font-semibold">
              <li><a href="#product" className="hover:text-[#111827] transition-colors">Features</a></li>
              <li><a href="#architecture" className="hover:text-[#111827] transition-colors">Architecture</a></li>
              <li><a href="#plans" className="hover:text-[#111827] transition-colors">Plans</a></li>
              <li><Link href="/dashboard" className="hover:text-[#111827] transition-colors">Demo Overview</Link></li>
            </ul>
          </div>

          {/* Resources Column */}
          <div className="space-y-3">
            <h5 className="text-[10px] font-bold uppercase tracking-wider text-[#111827]">Resources</h5>
            <ul className="space-y-2.5 text-xs font-semibold">
              <li><Link href="/dashboard" className="hover:text-[#111827] transition-colors">Documentation</Link></li>
              <li><span className="text-slate-400 font-medium cursor-default">Blog (Coming Soon)</span></li>
              <li><span className="text-slate-400 font-medium cursor-default">Changelog</span></li>
              <li>
                <a 
                  href="https://github.com" 
                  target="_blank" 
                  rel="noreferrer" 
                  className="flex items-center space-x-1 hover:text-[#111827] transition-colors"
                >
                  <Github className="h-3.5 w-3.5" />
                  <span>GitHub Repository</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Company Column */}
          <div className="space-y-3">
            <h5 className="text-[10px] font-bold uppercase tracking-wider text-[#111827]">Company</h5>
            <ul className="space-y-2.5 text-xs font-semibold">
              <li><span className="text-slate-400 font-medium cursor-default">About Us</span></li>
              <li><span className="text-slate-400 font-medium cursor-default">Contact Sales</span></li>
              <li><span className="text-slate-400 font-medium cursor-default">Privacy Policy</span></li>
              <li><span className="text-slate-400 font-medium cursor-default">Terms of Service</span></li>
            </ul>
          </div>

        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 pt-6 border-t border-slate-100 flex items-center justify-between text-[10px] font-semibold">
          <p>© 2026 FlientSec. All rights reserved.</p>
          <div className="flex space-x-4">
            <a href="mailto:info.krishnasingh.codes@gmail.com" className="hover:text-[#111827] transition-colors">Contact</a>
            <span className="hover:text-[#111827] transition-colors">Sitemap</span>
          </div>
        </div>
      </footer>

    </div>
  )
}
