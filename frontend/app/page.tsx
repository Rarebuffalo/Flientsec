"use client"

import React, { useState } from "react"
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
  Activity 
} from "lucide-react"

// Framer motion default animation variants
const faders = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
}

export default function LandingPage() {
  // Interactive mock dashboard state
  const [firewallEnabled, setFirewallEnabled] = useState(false)
  const [copiedText, setCopiedText] = useState("")

  const mockScore = firewallEnabled ? 85 : 45
  const mockStatus = firewallEnabled ? "WARN" : "FAIL"

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedText(text)
    setTimeout(() => setCopiedText(""), 2000)
  }

  return (
    <div className="bg-[#F8FAF8] text-slate-600 min-h-screen selection:bg-emerald-100 selection:text-emerald-900 font-sans">
      
      {/* 1. Announcement Bar */}
      <div className="bg-darkGreen text-emerald-300 text-xs py-2.5 px-4 text-center font-medium tracking-wide">
        Developer Workstation Security Platform <span className="mx-2">•</span> Launching Design Partner Program
      </div>

      {/* 2. Navigation Header */}
      <header className="border-b border-slate-200/60 bg-[#F8FAF8]/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-10">
            <Link href="/" className="flex items-center space-x-2.5">
              <img src="/logo_dark.png" alt="FlientSec Logo" className="h-8 w-8 object-contain" />
              <span className="font-extrabold tracking-tight text-2xl text-slate-900 bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 bg-clip-text text-transparent">FlientSec</span>
            </Link>
            <nav className="hidden md:flex items-center space-x-8 text-sm font-medium text-slate-500">
              <a href="#product" className="hover:text-slate-900 transition-colors">Product</a>
              <a href="#features" className="hover:text-slate-900 transition-colors">Features</a>
              <a href="#architecture" className="hover:text-slate-900 transition-colors">Architecture</a>
              <a href="#security" className="hover:text-slate-900 transition-colors">Security</a>
              <Link href="/dashboard" className="hover:text-slate-900 transition-colors">Docs</Link>
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/dashboard" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
              Sign In
            </Link>
            <a 
              href="#cta" 
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold rounded bg-primary hover:bg-emerald-800 text-white transition-colors shadow-sm"
            >
              Request Early Access
            </a>
          </div>
        </div>
      </header>

      {/* 3. Hero Section */}
      <section id="product" className="pt-20 pb-24 border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Hero Left Column */}
          <div className="lg:col-span-6 space-y-8">
            <motion.div 
              initial="hidden" 
              animate="visible" 
              variants={faders}
              className="space-y-6"
            >
              <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight">
                Know the security posture of every developer workstation—<span className="text-primary">in real time</span>.
              </h1>
              <p className="text-lg sm:text-xl text-slate-500 font-normal leading-relaxed">
                FlientSec continuously verifies every engineering workstation against your organization's security policies, giving security and engineering teams real-time visibility without deploying heavyweight enterprise MDM.
              </p>
            </motion.div>

            {/* CTAs */}
            <motion.div 
              initial="hidden" 
              animate="visible" 
              variants={faders}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4"
            >
              <a 
                href="#cta" 
                className="inline-flex items-center justify-center px-6 py-3.5 bg-primary hover:bg-emerald-800 text-white text-base font-bold rounded-lg transition-colors shadow-sm text-center"
              >
                Request Early Access
              </a>
              <a 
                href="#demo" 
                className="inline-flex items-center justify-center px-6 py-3.5 border border-slate-300 hover:bg-slate-50 text-slate-700 text-base font-semibold rounded-lg transition-colors text-center"
              >
                See Live Demo
              </a>
            </motion.div>
          </div>

          {/* Hero Right Column - Interactive Mock Dashboard Card */}
          <div className="lg:col-span-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="bg-white border border-slate-200 rounded-xl shadow-premium overflow-hidden font-sans"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center space-x-2">
                  <span className="h-3 w-3 rounded-full bg-slate-200"></span>
                  <span className="h-3 w-3 rounded-full bg-slate-200"></span>
                  <span className="h-3 w-3 rounded-full bg-slate-200"></span>
                  <span className="text-xs font-semibold text-slate-400 font-mono pl-2">dev-workstation-01</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-455 text-slate-400 font-medium">Compliance:</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    mockStatus === "FAIL" ? "bg-danger/10 text-danger border border-danger/20" : "bg-warning/10 text-warning border border-warning/20"
                  }`}>
                    {mockStatus}
                  </span>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Metrics header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Overall Posture Score</h4>
                    <p className="text-4xl font-extrabold font-mono text-slate-900 mt-1">{mockScore}%</p>
                  </div>
                  <div className="h-12 w-12 rounded-full border-4 border-slate-100 flex items-center justify-center font-mono font-bold text-slate-700 bg-slate-50">
                    {firewallEnabled ? "85" : "45"}
                  </div>
                </div>

                {/* Checks list */}
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between p-3 border border-slate-100 rounded-lg hover:bg-slate-50/30 transition-colors">
                    <div className="flex items-center space-x-3">
                      <ShieldCheck className="h-4.5 w-4.5 text-success" />
                      <span className="text-sm font-semibold text-slate-800">Root Disk Partition Encryption</span>
                    </div>
                    <span className="text-xs font-bold text-success bg-success/10 px-2 py-0.5 rounded">PASS</span>
                  </div>

                  <div className="flex items-center justify-between p-3 border border-slate-100 rounded-lg hover:bg-slate-50/30 transition-colors">
                    <div className="flex items-center space-x-3">
                      {firewallEnabled ? (
                        <ShieldCheck className="h-4.5 w-4.5 text-success" />
                      ) : (
                        <ShieldAlert className="h-4.5 w-4.5 text-danger" />
                      )}
                      <span className="text-sm font-semibold text-slate-800">Local Uncomplicated Firewall (UFW)</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${firewallEnabled ? "text-success bg-success/10" : "text-danger bg-danger/10"}`}>
                        {firewallEnabled ? "ACTIVE" : "INACTIVE"}
                      </span>
                      {/* Toggle button */}
                      <button 
                        onClick={() => setFirewallEnabled(!firewallEnabled)}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors focus:outline-none ${firewallEnabled ? "bg-primary" : "bg-slate-300"}`}
                      >
                        <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${firewallEnabled ? "translate-x-4" : "translate-x-0"}`}></div>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 border border-slate-100 rounded-lg hover:bg-slate-50/30 transition-colors">
                    <div className="flex items-center space-x-3">
                      <ShieldAlert className="h-4.5 w-4.5 text-warning" />
                      <span className="text-sm font-semibold text-slate-800">Pending System Security Updates</span>
                    </div>
                    <span className="text-xs font-bold text-warning bg-warning/10 px-2 py-0.5 rounded">21 WARNINGS</span>
                  </div>
                </div>

                {/* Remediation helper box */}
                {!firewallEnabled && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden mt-4 animate-pulse">
                    <div className="px-4 py-2 border-b border-slate-200 flex items-center justify-between bg-slate-100/50">
                      <span className="text-[11px] font-bold text-slate-500 font-mono flex items-center space-x-1">
                        <Terminal className="h-3.5 w-3.5 text-slate-500" />
                        <span>Interactive Remediation Command</span>
                      </span>
                      <button 
                        onClick={() => handleCopy("sudo ufw enable")}
                        className="text-[10px] font-extrabold text-primary hover:underline hover:text-emerald-800"
                      >
                        {copiedText ? "Copied!" : "Copy"}
                      </button>
                    </div>
                    <pre className="p-3 text-[11px] text-slate-800 font-mono bg-slate-50">
                      <code>sudo ufw enable</code>
                    </pre>
                  </div>
                )}
              </div>
            </motion.div>
          </div>

        </div>
      </section>

      {/* 4. Trust Strip Personas */}
      <section className="py-16 border-b border-slate-200/60 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs font-bold text-slate-400 uppercase tracking-widest mb-10">
            Built for engineering teams preparing for enterprise security requirements
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 border border-slate-150 rounded-lg hover:border-slate-300 transition-colors bg-[#F8FAF8]/50">
              <h3 className="text-lg font-bold text-slate-800">Startups</h3>
              <p className="text-xs text-slate-500 mt-2 font-medium leading-relaxed">
                Unlock enterprise customer deals instantly by demonstrating compliance and continuous posture logging.
              </p>
            </div>
            <div className="p-6 border border-slate-150 rounded-lg hover:border-slate-300 transition-colors bg-[#F8FAF8]/50">
              <h3 className="text-lg font-bold text-slate-800">Engineering Leaders</h3>
              <p className="text-xs text-slate-500 mt-2 font-medium leading-relaxed">
                Maintain continuous compliance without deploying heavy binary locks that slow down developer environments.
              </p>
            </div>
            <div className="p-6 border border-slate-150 rounded-lg hover:border-slate-300 transition-colors bg-[#F8FAF8]/50">
              <h3 className="text-lg font-bold text-slate-800">Security Teams</h3>
              <p className="text-xs text-slate-500 mt-2 font-medium leading-relaxed">
                Set and enforce policies (firewalls, encryption, packages) through code without managing legacy MDMs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Pain Section (Before vs After) */}
      <section className="py-24 border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Say goodbye to compliance fire drills
            </h2>
            <p className="text-slate-500 text-sm sm:text-base font-medium">
              Manually chasing screenshots from your developers when audits roll around is a waste of engineering time.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
            {/* Before manual checking */}
            <div className="border border-slate-200/60 bg-white rounded-xl p-8 space-y-6 flex flex-col justify-between shadow-sm">
              <div className="space-y-4">
                <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 px-2.5 py-1 rounded-full uppercase tracking-wider">
                  The Old Way
                </span>
                <h3 className="text-2xl font-extrabold text-slate-900">Manual Screenshot Chase</h3>
                <p className="text-sm text-slate-500 leading-relaxed font-medium">
                  Weeks spent messaging developers on Slack, tracking responses in spreadsheets, collating outdated audit reports, and resolving compliance drifts weeks after they occur.
                </p>
              </div>
              <div className="pt-6 border-t border-slate-100 flex items-center space-x-2 text-red-600 text-xl font-bold font-mono">
                <span>3 Days</span>
                <span className="text-xs text-slate-400 font-sans font-medium">average remediation time per workstation</span>
              </div>
            </div>

            {/* After continuous check-in */}
            <div className="border-2 border-primary/30 bg-emerald-50/10 rounded-xl p-8 space-y-6 flex flex-col justify-between shadow-premium">
              <div className="space-y-4">
                <span className="text-xs font-bold text-primary bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full uppercase tracking-wider">
                  With FlientSec
                </span>
                <h3 className="text-2xl font-extrabold text-slate-900">Continuous Telemetry Check-in</h3>
                <p className="text-sm text-slate-500 leading-relaxed font-medium">
                  Policy checks execute locally in the background. Compliance score recalculations happen automatically, and event audits generate instantly on demand.
                </p>
              </div>
              <div className="pt-6 border-t border-slate-100 flex items-center space-x-2 text-primary text-xl font-bold font-mono">
                <span>2 Minutes</span>
                <span className="text-xs text-slate-400 font-sans font-medium">automatic installation and enrollment</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Why FlientSec (Pillars) */}
      <section className="py-24 bg-white border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Workstation posture, reimagined
            </h2>
            <p className="text-slate-500 text-sm sm:text-base font-medium">
              We built FlientSec around three core principles that modern engineering organizations demand.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="space-y-4">
              <div className="h-10 w-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-primary">
                <Cpu className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Lightweight Agent</h3>
              <p className="text-sm text-slate-500 leading-relaxed font-medium">
                No central device lockouts. The Go Agent binary operates quietly as a user daemon, querying settings locally without taxing resources.
              </p>
            </div>
            <div className="space-y-4">
              <div className="h-10 w-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-primary">
                <Lock className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Privacy First</h3>
              <p className="text-sm text-slate-500 leading-relaxed font-medium">
                We only inspect the security settings you define. We strictly capture configuration metrics, never employee screens, input logs, or code bases.
              </p>
            </div>
            <div className="space-y-4">
              <div className="h-10 w-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-primary">
                <Clock className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Always Audit Ready</h3>
              <p className="text-sm text-slate-500 leading-relaxed font-medium">
                Compliance histories are recorded in the central database, generating downloadable compliance reports ready to pass SOC2 reviews.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Features Grid */}
      <section id="features" className="py-24 border-b border-slate-200/60 bg-slate-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Features built for technical buyers
            </h2>
            <p className="text-slate-500 text-sm sm:text-base font-medium">
              Minimal overhead, complete control. Keep developer workstations compliant with zero noise.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white border border-slate-200/60 rounded-xl p-8 shadow-premium space-y-4">
              <span className="text-xs font-bold text-primary uppercase tracking-widest">Verification</span>
              <h3 className="text-xl font-bold text-slate-900">Continuous Verification</h3>
              <p className="text-sm text-slate-500 leading-relaxed font-medium">
                The agent periodically runs system tests: verifying local firewalls (UFW, iptables), checks for root mount encryption, queries pending package upgrades, and maps compiler runtimes (Node, Python).
              </p>
            </div>
            <div className="bg-white border border-slate-200/60 rounded-xl p-8 shadow-premium space-y-4">
              <span className="text-xs font-bold text-primary uppercase tracking-widest">Configuration</span>
              <h3 className="text-xl font-bold text-slate-900">Flexible Policy Engine</h3>
              <p className="text-sm text-slate-500 leading-relaxed font-medium">
                Store compliance rules in a unified YAML configuration. Sync checks across the fleet, adjust severity bounds, and apply custom requirements dynamically.
              </p>
            </div>
            <div className="bg-white border border-slate-200/60 rounded-xl p-8 shadow-premium space-y-4">
              <span className="text-xs font-bold text-primary uppercase tracking-widest">Monitoring</span>
              <h3 className="text-xl font-bold text-slate-900">Fleet Health Overview</h3>
              <p className="text-sm text-slate-500 leading-relaxed font-medium">
                A single unified portal showing connection status heartbeats, compliance grades (PASS/WARN/FAIL), OS architectures, and check histories.
              </p>
            </div>
            <div className="bg-white border border-slate-200/60 rounded-xl p-8 shadow-premium space-y-4">
              <span className="text-xs font-bold text-primary uppercase tracking-widest">Evidence</span>
              <h3 className="text-xl font-bold text-slate-900">Audit Evidence Logs</h3>
              <p className="text-sm text-slate-500 leading-relaxed font-medium">
                Compliance score histories and transitions (e.g. trigger warnings on disabled firewall, resolutions when enabled) log automatically. Download compliance reports in CSV format.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Onboarding Timeline */}
      <section id="demo" className="py-24 bg-white border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Get started in four simple steps
            </h2>
            <p className="text-slate-500 text-sm sm:text-base font-medium">
              We design FlientSec to take the friction out of onboarding.
            </p>
          </div>

          {/* Timeline - Horizontal for desktop, vertical on mobile */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8 relative">
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-100 hidden md:block -translate-y-1/2 z-0"></div>
            
            <div className="bg-white p-6 border border-slate-150 rounded-lg shadow-sm space-y-4 relative z-10 flex flex-col justify-between h-48">
              <div>
                <span className="h-6 w-6 rounded-full bg-emerald-50 border border-emerald-100 text-primary flex items-center justify-center text-xs font-bold font-mono">1</span>
                <h4 className="font-bold text-slate-800 text-sm mt-3">Install Agent</h4>
              </div>
              <p className="text-[11px] text-slate-500 leading-normal font-medium">Run the one-line install shell command to compile and deploy the Go user daemon.</p>
            </div>

            <div className="bg-white p-6 border border-slate-150 rounded-lg shadow-sm space-y-4 relative z-10 flex flex-col justify-between h-48">
              <div>
                <span className="h-6 w-6 rounded-full bg-emerald-50 border border-emerald-100 text-primary flex items-center justify-center text-xs font-bold font-mono">2</span>
                <h4 className="font-bold text-slate-800 text-sm mt-3">Policy Sync</h4>
              </div>
              <p className="text-[11px] text-slate-500 leading-normal font-medium">The agent fetches the active organizational YAML rules securely on check-in.</p>
            </div>

            <div className="bg-white p-6 border border-slate-150 rounded-lg shadow-sm space-y-4 relative z-10 flex flex-col justify-between h-48">
              <div>
                <span className="h-6 w-6 rounded-full bg-emerald-50 border border-emerald-100 text-primary flex items-center justify-center text-xs font-bold font-mono">3</span>
                <h4 className="font-bold text-slate-800 text-sm mt-3">Verify Posture</h4>
              </div>
              <p className="text-[11px] text-slate-500 leading-normal font-medium">Checks execute locally in the background, validating status and computing scores.</p>
            </div>

            <div className="bg-white p-6 border border-slate-150 rounded-lg shadow-sm space-y-4 relative z-10 flex flex-col justify-between h-48">
              <div>
                <span className="h-6 w-6 rounded-full bg-emerald-50 border border-emerald-100 text-primary flex items-center justify-center text-xs font-bold font-mono">4</span>
                <h4 className="font-bold text-slate-800 text-sm mt-3">Platform Update</h4>
              </div>
              <p className="text-[11px] text-slate-500 leading-normal font-medium">Heartbeats ping telemetry logs, updating the central dashboard in real time.</p>
            </div>

            <div className="bg-white p-6 border border-slate-150 rounded-lg shadow-sm space-y-4 relative z-10 flex flex-col justify-between h-48">
              <div>
                <span className="h-6 w-6 rounded-full bg-emerald-50 border border-emerald-100 text-primary flex items-center justify-center text-xs font-bold font-mono">5</span>
                <h4 className="font-bold text-slate-800 text-sm mt-3">Evidence</h4>
              </div>
              <p className="text-[11px] text-slate-500 leading-normal font-medium">Audit logs track compliance transitions and export CSV reports instantly.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 9. Technical Architecture */}
      <section id="architecture" className="py-24 border-b border-slate-200/60 bg-slate-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Symmetric System Architecture
            </h2>
            <p className="text-slate-500 text-sm sm:text-base font-medium">
              FlientSec leverages a distributed evaluation model where policy checks execute entirely on the client workstation.
            </p>
          </div>

          {/* Clean modern SVG schema diagram */}
          <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-premium flex items-center justify-center">
            <svg 
              viewBox="0 0 800 240" 
              className="w-full max-w-4xl font-sans text-xs" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Nodes styling & backgrounds */}
              <rect x="10" y="70" width="130" height="80" rx="8" fill="#F1F5F9" stroke="#E2E8F0" strokeWidth="2" />
              <rect x="190" y="70" width="130" height="80" rx="8" fill="#F1F5F9" stroke="#E2E8F0" strokeWidth="2" />
              <rect x="370" y="70" width="140" height="80" rx="8" fill="#103B33" stroke="#103B33" strokeWidth="2" />
              <rect x="560" y="20" width="130" height="70" rx="8" fill="#F8FAF8" stroke="#E2E8F0" strokeWidth="2" />
              <rect x="560" y="130" width="130" height="70" rx="8" fill="#F8FAF8" stroke="#E2E8F0" strokeWidth="2" />

              {/* Connecting path arrows */}
              <path d="M 140 110 L 190 110" stroke="#CBD5E1" strokeWidth="2" markerEnd="url(#arrow)" />
              <path d="M 320 110 L 370 110" stroke="#CBD5E1" strokeWidth="2" markerEnd="url(#arrow)" />
              <path d="M 510 110 L 530 110 L 530 55 L 560 55" stroke="#CBD5E1" strokeWidth="2" markerEnd="url(#arrow)" />
              <path d="M 510 110 L 530 110 L 530 165 L 560 165" stroke="#CBD5E1" strokeWidth="2" markerEnd="url(#arrow)" />

              {/* Text labels inside nodes */}
              <text x="75" y="105" textAnchor="middle" fill="#0F172A" fontWeight="bold">Workstation</text>
              <text x="75" y="125" textAnchor="middle" fill="#64748B" fontSize="10">Arch / Ubuntu</text>

              <text x="255" y="105" textAnchor="middle" fill="#0F172A" fontWeight="bold">Go Agent</text>
              <text x="255" y="125" textAnchor="middle" fill="#64748B" fontSize="10">Local Evaluation</text>

              <text x="440" y="105" textAnchor="middle" fill="#39D98A" fontWeight="bold">Secure API</text>
              <text x="440" y="125" textAnchor="middle" fill="#A7F3D0" fontSize="10">HTTPS Telemetry</text>

              <text x="625" y="50" textAnchor="middle" fill="#0F172A" fontWeight="bold">Dashboard</text>
              <text x="625" y="66" textAnchor="middle" fill="#64748B" fontSize="10">Fleet Health</text>

              <text x="625" y="160" textAnchor="middle" fill="#0F172A" fontWeight="bold">Evidence</text>
              <text x="625" y="176" textAnchor="middle" fill="#64748B" fontSize="10">CSV Audit Logs</text>

              {/* Marker definitions */}
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#CBD5E1" />
                </marker>
              </defs>
            </svg>
          </div>
        </div>
      </section>

      {/* 10. Comparison Table */}
      <section className="py-24 bg-white border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Obvious product positioning
            </h2>
            <p className="text-slate-500 text-sm sm:text-base font-medium">
              We focus on security posture without intrusive device profiles.
            </p>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-premium bg-white">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-800 text-sm font-bold">
                  <th className="px-6 py-4">Security Verification</th>
                  <th className="px-6 py-4 text-center">Manual checklists</th>
                  <th className="px-6 py-4 text-center">Traditional MDM</th>
                  <th className="px-6 py-4 text-center text-primary bg-emerald-50/20">FlientSec</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-600">
                <tr className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-slate-800">Continuous posture checks</td>
                  <td className="px-6 py-4 text-center"><X className="h-5 w-5 text-red-400 mx-auto" /></td>
                  <td className="px-6 py-4 text-center"><Check className="h-5 w-5 text-success mx-auto" /></td>
                  <td className="px-6 py-4 text-center bg-emerald-50/20"><Check className="h-5 w-5 text-success mx-auto" /></td>
                </tr>
                <tr className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-slate-800">Lightweight client installation</td>
                  <td className="px-6 py-4 text-center"><X className="h-5 w-5 text-red-400 mx-auto" /></td>
                  <td className="px-6 py-4 text-center"><X className="h-5 w-5 text-red-400 mx-auto" /></td>
                  <td className="px-6 py-4 text-center bg-emerald-50/20"><Check className="h-5 w-5 text-success mx-auto" /></td>
                </tr>
                <tr className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-slate-800">Respects developer privacy</td>
                  <td className="px-6 py-4 text-center"><Check className="h-5 w-5 text-success mx-auto" /></td>
                  <td className="px-6 py-4 text-center"><X className="h-5 w-5 text-red-400 mx-auto" /></td>
                  <td className="px-6 py-4 text-center bg-emerald-50/20"><Check className="h-5 w-5 text-success mx-auto" /></td>
                </tr>
                <tr className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-slate-800">Zero device blockout policies</td>
                  <td className="px-6 py-4 text-center"><Check className="h-5 w-5 text-success mx-auto" /></td>
                  <td className="px-6 py-4 text-center"><X className="h-5 w-5 text-red-400 mx-auto" /></td>
                  <td className="px-6 py-4 text-center bg-emerald-50/20"><Check className="h-5 w-5 text-success mx-auto" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 11. Developer Trust by Design (Privacy Checklist) */}
      <section id="security" className="py-24 border-b border-slate-200/60 bg-slate-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Developer Trust by Design
            </h2>
            <p className="text-slate-500 text-sm sm:text-base font-medium">
              We design FlientSec to respect developer workstation bounds. Transparency builds actual organization security.
            </p>
          </div>

          <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-xl p-8 shadow-premium space-y-6">
            <h3 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-3">Telemetry Bound Limits</h3>
            <ul className="space-y-4 text-sm font-medium">
              <li className="flex items-center space-x-3 text-slate-700">
                <span className="h-5 w-5 rounded-full bg-emerald-50 text-primary flex items-center justify-center"><Check className="h-3.5 w-3.5" /></span>
                <span>No screen capture or video recording</span>
              </li>
              <li className="flex items-center space-x-3 text-slate-700">
                <span className="h-5 w-5 rounded-full bg-emerald-50 text-primary flex items-center justify-center"><Check className="h-3.5 w-3.5" /></span>
                <span>No keystroke monitoring or input logging</span>
              </li>
              <li className="flex items-center space-x-3 text-slate-700">
                <span className="h-5 w-5 rounded-full bg-emerald-50 text-primary flex items-center justify-center"><Check className="h-3.5 w-3.5" /></span>
                <span>No source code file scanner or reading</span>
              </li>
              <li className="flex items-center space-x-3 text-slate-700">
                <span className="h-5 w-5 rounded-full bg-emerald-50 text-primary flex items-center justify-center"><Check className="h-3.5 w-3.5" /></span>
                <span>Only security settings posture metadata</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* 12. Final CTA */}
      <section id="cta" className="py-24 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-darkGreen rounded-2xl p-12 text-center text-white space-y-8 shadow-lg">
            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
              Know your workstation security posture in minutes.
            </h2>
            <p className="text-emerald-200 text-base max-w-2xl mx-auto font-medium">
              Join our Launch Design Partner Program to continuously audit engineering laptops without friction.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button 
                onClick={() => alert("Thank you for requesting early access! Our team will contact you shortly.")}
                className="inline-flex items-center justify-center px-6 py-3.5 bg-primary hover:bg-emerald-800 text-white font-bold rounded-lg transition-colors shadow-sm"
              >
                Request Early Access
              </button>
              <Link 
                href="/dashboard" 
                className="inline-flex items-center justify-center px-6 py-3.5 border border-emerald-500/30 hover:bg-emerald-800/20 text-emerald-300 font-semibold rounded-lg transition-colors"
              >
                Launch Live Demo
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 13. Enterprise Footer */}
      <footer className="border-t border-slate-200/60 bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 gap-8">
          
          <div className="space-y-4 col-span-2 md:col-span-1">
            <div className="flex items-center space-x-2.5">
              <img src="/logo_dark.png" alt="FlientSec Logo" className="h-8 w-8 object-contain" />
              <span className="font-extrabold tracking-tight text-2xl text-slate-900 bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 bg-clip-text text-transparent">FlientSec</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed font-medium">
              Lightweight developer workstation compliance platform designed for modern engineering teams.
            </p>
          </div>

          <div className="space-y-3">
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-800">Product</h5>
            <ul className="space-y-2 text-xs font-medium text-slate-500">
              <li><a href="#product" className="hover:text-slate-900 transition-colors">Mockup</a></li>
              <li><a href="#features" className="hover:text-slate-900 transition-colors">Features</a></li>
              <li><a href="#architecture" className="hover:text-slate-900 transition-colors">Architecture</a></li>
              <li><Link href="/dashboard" className="hover:text-slate-900 transition-colors">Live Dashboard</Link></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-800">Security</h5>
            <ul className="space-y-2 text-xs font-medium text-slate-500">
              <li><a href="#security" className="hover:text-slate-900 transition-colors">Developer Privacy</a></li>
              <li><Link href="/policies" className="hover:text-slate-900 transition-colors">Policy Controls</Link></li>
              <li><span className="text-slate-400">SOC2 Ready</span></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-800">GitHub</h5>
            <ul className="space-y-2 text-xs font-medium text-slate-500">
              <li>
                <a 
                  href="https://github.com" 
                  target="_blank" 
                  rel="noreferrer" 
                  className="flex items-center space-x-1 hover:text-slate-900 transition-colors"
                >
                  <Github className="h-3.5 w-3.5" />
                  <span>flientsec-monorepo</span>
                </a>
              </li>
              <li><span className="text-slate-400">License: Apache-2.0</span></li>
            </ul>
          </div>

        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 pt-6 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
          <p>© 2026 FlientSec. All rights reserved.</p>
          <div className="flex space-x-4">
            <span className="hover:text-slate-900 transition-colors">Privacy Policy</span>
            <span className="hover:text-slate-900 transition-colors">Terms of Service</span>
          </div>
        </div>
      </footer>

    </div>
  )
}
