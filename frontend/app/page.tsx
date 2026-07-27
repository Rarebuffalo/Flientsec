"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"

export default function LandingPage() {
  // Interactive mock states
  const [firewallActive, setFirewallActive] = useState(false)
  const [copiedCmd, setCopiedCmd] = useState(false)
  const [copiedText, setCopiedText] = useState("")
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  
  const ubuntuScore = firewallActive ? 100 : 60
  const ubuntuStatus = firewallActive ? "VERIFIED" : "WARNING"

  const [recentEvents, setRecentEvents] = useState<string[]>([
    "Compliance status evaluated score: 60",
    "UFW Firewall setting check: FAIL",
    "LUKS disk encryption mount check: PASS",
    "Workstation registration complete: OK"
  ])

  // Append logs when UFW is toggled
  useEffect(() => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    if (firewallActive) {
      setRecentEvents((prev) => [
        `[${timestamp}] [SYS] UFW firewall policy update: ENABLED`,
        `[${timestamp}] [POLICY] evaluation score recalculated: 100`,
        ...prev.slice(0, 2)
      ])
    } else {
      setRecentEvents((prev) => [
        `[${timestamp}] [SYS] UFW firewall policy update: DISABLED`,
        `[${timestamp}] [POLICY] evaluation score recalculated: 60`,
        ...prev.slice(0, 2)
      ])
    }
  }, [firewallActive])

  // Dynamic Dark Mode mount hook
  useEffect(() => {
    document.documentElement.classList.add("dark")
    document.body.style.backgroundColor = "#13131b"
    document.body.style.color = "#e5e1e7"
    return () => {
      document.documentElement.classList.remove("dark")
      document.body.style.backgroundColor = ""
      document.body.style.color = ""
    }
  }, [])

  // Mousemove parallax effect for the 3D diorama
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const diorama = document.querySelector('.diorama-panel') as HTMLElement;
      if (!diorama) return;
      
      const x = (e.clientX / window.innerWidth - 0.5) * 15;
      const y = (e.clientY / window.innerHeight - 0.5) * 15;
      
      diorama.style.transform = `rotateY(${-15 + x}deg) rotateX(${5 - y}deg) translateZ(-150px) translateX(20%) scale(1.05)`;
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Intersection Observer for scroll reveal animations
  useEffect(() => {
    const revealElements = document.querySelectorAll('.reveal');
    const revealOptions = {
      threshold: 0.1,
      rootMargin: "0px 0px -50px 0px"
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
          observer.unobserve(entry.target);
        }
      });
    }, revealOptions);

    revealElements.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const copyInstallerCommand = () => {
    navigator.clipboard.writeText("curl -sL https://flient.sec/install | bash")
    setCopiedCmd(true)
    setTimeout(() => setCopiedCmd(false), 2000)
  }

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedText(text)
    setTimeout(() => setCopiedText(""), 2000)
  }

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
    <div className="bg-background text-on-surface font-body-base min-h-screen flex flex-col selection:bg-primary-container selection:text-on-primary-container">
      
      {/* 1. Announcement Bar */}
      <div className="w-full bg-surface-container-low border-b-[0.5px] border-outline-variant h-[32px] flex items-center justify-center relative z-50">
        <span className="font-code-label text-code-label text-on-surface-variant flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-secondary-fixed-dim pulse-heartbeat-anim"></span>
          Developer Workstation Security Platform
        </span>
      </div>

      {/* 2. Floating Navigation Header Wrapper (Static Trigger Area) */}
      <nav className="fixed top-[48px] left-6 right-6 mx-auto max-w-container-max h-14 z-50 group">
        {/* Animated Inner Visual Pill */}
        <div className="w-full h-full rounded-full border-[0.5px] border-outline-variant bg-surface/80 backdrop-blur-md shadow-2xl shadow-black/40 flex justify-between items-center px-4 md:px-6 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.6),0_0_20px_rgba(192,193,255,0.1)]">
          <Link className="font-headline-md text-[20px] md:text-headline-md font-bold tracking-tight text-on-surface flex items-center gap-2" href="#">
            <img src="/logo_light.png" alt="FlientSec Logo" className="h-6 w-6 object-contain" />
            FlientSec
          </Link>
          <div className="hidden md:flex items-center gap-1 font-body-sm text-body-sm">
            <a className="px-4 py-2 text-primary font-medium hover:bg-surface-bright/10 rounded-full transition-all duration-200" href="#">Product</a>
            <a className="px-4 py-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-bright/10 rounded-full transition-all duration-200" href="#features">Features</a>
            <a className="px-4 py-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-bright/10 rounded-full transition-all duration-200" href="#architecture">Architecture</a>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <Link className="hidden md:flex font-code-label text-code-label text-on-surface-variant hover:text-on-surface px-4 py-2 transition-colors" href="/login">Sign In</Link>
            <a 
              className="font-code-label text-code-label bg-primary text-on-primary px-4 md:px-5 py-2 rounded-full hover:bg-primary-fixed transition-colors font-medium relative dot-reveal hover:scale-[1.02] active:scale-[0.98] transition-transform" 
              href="#cta"
            >
              Request Access
            </a>
          </div>
        </div>
      </nav>

      {/* 3. Hero Section */}
      <section className="relative pt-40 pb-32 overflow-hidden perspective-container min-h-[900px] mb-[240px]">
        <div className="absolute inset-0 z-0 pointer-events-none opacity-60 mix-blend-screen blueprint-grid"></div>
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop relative z-10 w-full h-full flex flex-col justify-center">
          
          {/* Mid-ground Interactive Security Panel (Diorama) */}
          <div className="absolute right-[-5%] top-1/2 -translate-y-1/2 w-[960px] h-[720px] pointer-events-none opacity-40 md:opacity-100 transition-all duration-700 ease-out z-0 diorama-panel" style={{ transform: "rotateY(-15deg) rotateX(5deg) translateZ(-150px) translateX(20%)", transformStyle: "preserve-3d" }}>
            <div className="absolute inset-0 rounded-xl border border-outline-variant/30 bg-[#0e0e11]/55 backdrop-blur-[4px] overflow-hidden ring-1 ring-inset ring-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
              <div className="h-12 border-b-[0.5px] border-outline-variant/50 flex items-center px-4 justify-between bg-[#131317]/80">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-outline-variant/30"></span>
                  <span className="w-3 h-3 rounded-full bg-outline-variant/30"></span>
                  <span className="w-3 h-3 rounded-full bg-outline-variant/30"></span>
                </div>
                <span className="font-code-label text-[12px] text-on-surface-variant">fleet_overview.json</span>
              </div>
              
              {/* Continuous Scrolling Log Stream */}
              <div className="absolute inset-y-12 left-[40%] right-[35%] overflow-hidden border-x-[0.5px] border-outline-variant/20 bg-terminal-black/45 opacity-85 z-float-1">
                <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-[#0e0e11] to-transparent z-10"></div>
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#0e0e11] to-transparent z-10"></div>
                <div className="flex flex-col animate-scroll-y font-log-tiny text-[9px] leading-relaxed p-4 space-y-2 w-full">
                  <div className="text-secondary-fixed-dim opacity-95">&gt; [AUTH] session verified: sys-admin</div>
                  <div className="text-primary-fixed-dim opacity-95">&gt; [TPM] attestation active: dev-wk-11</div>
                  <div className="text-[#34d399] opacity-95">&gt; [NET] tunnel established: node-tx-99</div>
                  <div className="text-on-surface opacity-95">&gt; [SYS] policy eval: strict_firewall OK</div>
                  <div className="text-secondary-fixed-dim opacity-95">&gt; [SEC] biometric token renewed</div>
                  <div className="text-primary-fixed-dim opacity-95">&gt; [AUTH] token valid: exp 1h</div>
                  <div className="text-on-surface opacity-95">&gt; [TPM] pcr0 verified: match</div>
                  <div className="text-[#34d399] opacity-95">&gt; [NET] zero-trust posture: OK</div>
                  <div className="text-primary-fixed-dim opacity-95">&gt; [SYS] osquery sig check: match</div>
                  <div className="text-secondary-fixed-dim opacity-95">&gt; [AUTH] session verified: sys-admin</div>
                  <div className="text-primary-fixed-dim opacity-95">&gt; [TPM] attestation active: dev-wk-11</div>
                  <div className="text-[#34d399] opacity-95">&gt; [NET] tunnel established: node-tx-99</div>
                  <div className="text-on-surface opacity-95">&gt; [SYS] policy eval: strict_firewall OK</div>
                  <div className="text-secondary-fixed-dim opacity-95">&gt; [SEC] biometric token renewed</div>
                  <div className="text-primary-fixed-dim opacity-95">&gt; [AUTH] token valid: exp 1h</div>
                  <div className="text-on-surface opacity-95">&gt; [TPM] pcr0 verified: match</div>
                  <div className="text-[#34d399] opacity-95">&gt; [NET] zero-trust posture: OK</div>
                  <div className="text-primary-fixed-dim opacity-95">&gt; [SYS] osquery sig check: match</div>
                </div>
              </div>

              {/* eng-ws-042 Node (Interactive Card) */}
              <div className="absolute top-[20%] left-[5%] w-[336px] unified-card bg-surface-container-high/90 p-4 z-float-2 backdrop-blur-md hover-elevate shadow-2xl pointer-events-auto">
                <div className="flex items-start justify-between mb-4 border-b-[0.5px] border-outline-variant/50 pb-3">
                  <div>
                    <h3 className="font-code-label text-[12px] text-on-surface mb-1 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px]">laptop_mac</span>
                      eng-ws-042
                    </h3>
                    <div className="font-code-label text-[10px] text-on-surface-variant space-y-0.5 mt-1">
                      <div>Ubuntu 24.04 LTS</div>
                      <div>Kernel 6.8.0-1015-azure</div>
                      <div className="text-[#064e3b] dark:text-[#34d399] flex items-center gap-1.5">
                        Agent v2.4.1 (active)
                        <span className="w-1.5 h-1.5 rounded-full bg-secondary pulse-heartbeat-anim"></span>
                      </div>
                    </div>
                  </div>
                  
                  <div className={`px-2 py-0.5 rounded border flex items-center gap-1.5 shadow-sm transition-all duration-300 ${
                    firewallActive 
                      ? "bg-[#064e3b] border-secondary/30 text-[#34d399] shadow-[0_0_10px_rgba(6,78,59,0.3)]" 
                      : "bg-amber-950/20 border-amber-500/30 text-amber-500 shadow-[0_0_10px_rgba(180,83,9,0.15)]"
                  }`}>
                    <span className="relative flex h-2 w-2">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${firewallActive ? "bg-[#34d399]" : "bg-amber-500"}`}></span>
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${firewallActive ? "bg-[#34d399]" : "bg-amber-500"}`}></span>
                    </span>
                    <span className="font-code-label text-[9px] font-bold tracking-wider">{ubuntuStatus} ({ubuntuScore})</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center border-b-[0.5px] border-outline-variant/50 pb-2">
                    <span className="font-body-sm text-body-sm text-on-surface-variant text-[13px]">Disk Encryption</span>
                    <span className="font-code-label text-[9px] text-[#34d399] font-bold tracking-wider">PASS</span>
                  </div>
                  
                  {/* Interactive Firewall Switch */}
                  <div className="flex justify-between items-center border-b-[0.5px] border-outline-variant/50 pb-2">
                    <span className="font-body-sm text-body-sm text-on-surface-variant text-[13px]">UFW Firewall</span>
                    <button 
                      onClick={() => setFirewallActive(!firewallActive)}
                      className={`w-8 h-4.5 rounded-full p-0.5 transition-colors focus:outline-none ${firewallActive ? "bg-secondary" : "bg-outline-variant"}`}
                      title={firewallActive ? "Disable Firewall" : "Enable Firewall"}
                    >
                      <div className={`bg-white w-3 h-3 rounded-full shadow-sm transform transition-transform duration-200 ${firewallActive ? "translate-x-3.5" : "translate-x-0"}`}></div>
                    </button>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="font-body-sm text-body-sm text-on-surface-variant text-[13px]">Biometrics</span>
                    <span className="font-code-label text-[9px] text-[#34d399] font-bold tracking-wider">Required</span>
                  </div>
                </div>
              </div>

              {/* Live Audit Log Card */}
              <div className="absolute bottom-[10%] right-[2%] w-[420px] unified-card bg-[#0a0a0f]/95 p-4 z-float-3 backdrop-blur-xl hover-elevate shadow-2xl">
                <div className="flex items-center gap-2 mb-3 border-b-[0.5px] border-outline-variant/30 pb-2">
                  <span className="material-symbols-outlined text-primary-fixed-dim text-[14px]">terminal</span>
                  <span className="font-code-label text-[12px] text-on-surface-variant">live_audit_stream</span>
                  <div className="ml-auto flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary-fixed-dim pulse-heartbeat-anim"></span>
                  </div>
                </div>
                <div className="font-code-label text-[11px] leading-[1.8] space-y-1.5">
                  {recentEvents.map((evt, idx) => (
                    <div key={idx} className={`log-entry ${idx === 0 ? "text-primary-fixed-dim" : "text-on-surface-variant"}`}>
                      {evt}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="absolute -left-12 top-[10%] px-3 py-1.5 unified-card bg-surface-container-high/90 flex items-center gap-2 z-float-3 backdrop-blur-md hover-elevate" style={{ transform: "translateZ(80px)" }}>
              <span className="material-symbols-outlined text-[14px] text-on-surface-variant">policy</span>
              <span className="font-code-label text-[12px] text-on-surface">Policy as Code</span>
            </div>
            <div className="absolute -bottom-8 left-[30%] px-3 py-1.5 unified-card bg-surface-container-high/90 flex items-center gap-2 z-float-1 backdrop-blur-md hover-elevate" style={{ transform: "translateZ(40px)" }}>
              <span className="material-symbols-outlined text-[14px] text-on-surface-variant">terminal</span>
              <span className="font-code-label text-[12px] text-on-surface">Linux Native</span>
            </div>
          </div>

          {/* Foreground Typography Block */}
          <div className="relative z-20 max-w-3xl pt-20 md:pt-10 mix-blend-normal">
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 rounded-full border-[0.5px] border-outline-variant bg-surface-container-low/80 backdrop-blur-sm hover-elevate cursor-default">
              <span className="w-2 h-2 rounded-full bg-primary-fixed-dim"></span>
              <span className="font-code-label text-[12px] text-on-surface-variant">FlientSec Core v2.4 Released</span>
            </div>
            
            <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg text-on-surface mb-6 tracking-tighter leading-[1.02] tracking-[-0.05em]" style={{ textShadow: "0 4px 24px rgba(0,0,0,0.5)" }}>
              <span className="block text-on-surface-variant">Stop chasing</span>
              <span className="block text-on-surface-variant mb-1">compliance screenshots.</span>
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary to-surface-tint">Know every workstation</span>
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary to-surface-tint">is secure.</span>
            </h1>
            
            <p className="font-body-base text-body-base text-on-surface-variant max-w-xl mb-10 leading-relaxed">
              FlientSec continuously verifies every workstation against your organization's security baseline. Know what is compliant, what is not, and exactly how to remediate drifts—without deploying intrusive MDM profiles.
            </p>
            
            {/* Typing bash installer card */}
            <div className="w-full max-w-lg unified-card bg-[#000000] flex flex-col overflow-hidden relative z-30 hover-elevate transition-all duration-300">
              <div className="h-8 bg-surface-container-high border-b-[0.5px] border-outline-variant flex items-center px-3 justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]"></div>
                </div>
                <span className="font-code-label text-[10px] text-on-surface-variant">bash</span>
              </div>
              <div 
                className={`p-4 flex items-center justify-between group cursor-pointer relative ${copiedCmd ? "copied" : ""}`} 
                onClick={copyInstallerCommand}
                title="Click to copy installer script"
              >
                <code className="font-code-label text-[12px] text-primary-fixed-dim flex items-center">
                  <span className="text-outline select-none mr-2">$</span>
                  <span className="typing-anim">curl -sL https://flient.sec/install | bash</span>
                  <span className="cursor-blink"></span>
                </code>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded bg-surface-container-high border-[0.5px] border-outline-variant flex items-center justify-center">
                  <span className="material-symbols-outlined text-[16px] text-on-surface-variant copy-icon transition-transform">content_copy</span>
                </div>
                <div className="absolute inset-0 bg-[#064e3b]/90 text-white flex items-center justify-center font-code-label text-[12px] opacity-0 transition-opacity duration-300 pointer-events-none group-[.copied]:opacity-100">
                  Copied to clipboard!
                </div>
              </div>
            </div>

            <div className="mt-8 flex items-center gap-6 font-body-sm text-body-sm text-on-surface-variant">
              <div className="flex items-center gap-2 bg-surface-container-low/50 px-3 py-1.5 rounded-full border-[0.5px] border-outline-variant/50 backdrop-blur-sm shadow-sm">
                <span className="material-symbols-outlined text-[18px] text-secondary">bolt</span>
                <span>Deploy in &lt; 5 mins</span>
              </div>
              <div className="flex items-center gap-2 bg-surface-container-low/50 px-3 py-1.5 rounded-full border-[0.5px] border-outline-variant/50 backdrop-blur-sm shadow-sm">
                <span className="material-symbols-outlined text-[18px] text-primary-fixed-dim">lock</span>
                <span>SOC2 / ISO27001 Ready</span>
              </div>
            </div>
          </div>
          
        </div>
      </section>

      {/* 4. Problem / Workflow Section */}
      <section className="max-w-container-max mx-auto px-6 w-full flex flex-col relative z-10 mb-[240px] blueprint-grid reveal">
        <header className="mb-20 text-center lg:text-left z-20">
          <h2 className="font-display-lg-mobile md:font-display-lg text-on-surface mb-4">The Compliance Friction Loop</h2>
          <p className="font-body-base text-body-base text-on-surface-variant max-w-2xl">
            Manual attestation is fundamentally broken. It relies on point-in-time human actions rather than continuous, automated cryptographic proof.
          </p>
        </header>
        
        <div className="relative w-full unified-card p-10 flex flex-col lg:flex-row gap-12 items-stretch z-10 overflow-hidden bg-surface-dim/80">
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" xmlns="http://www.w3.org/2000/svg">
            <path className="hidden lg:block" d="M 150 100 L 250 100 L 250 300 L 350 300" fill="none" stroke="var(--tw-colors-outline-variant)" strokeWidth="1" />
            <path className="lg:hidden block" d="M 50% 150 L 50% 400" fill="none" stroke="var(--tw-colors-outline-variant)" strokeWidth="1" />
          </svg>
          
          <div className="flex-1 flex flex-col items-center lg:items-start relative z-10 group opacity-70 hover:opacity-100 transition-opacity duration-300">
            <div className="font-code-label text-[12px] text-outline mb-8 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-surface-bright"></span> Legacy Workflow
            </div>
            
            <div className="space-y-12 w-full max-w-sm relative">
              <div className="absolute left-6 top-8 bottom-8 w-px bg-outline-variant/30 hidden lg:block"></div>
              
              <div className="flex items-start gap-4 relative">
                <div className="w-12 h-12 rounded-lg bg-surface-container-high border border-outline-variant flex items-center justify-center shrink-0 z-10">
                  <span className="material-symbols-outlined text-outline" style={{ fontVariationSettings: "'FILL' 0" }}>chat</span>
                </div>
                <div className="glass-panel p-4 w-full border-[0.5px]">
                  <div className="font-code-label text-[12px] text-outline mb-1">REQ_ATTESTATION</div>
                  <div className="font-body-sm text-body-sm text-on-surface-variant">"Can you send a screenshot of your disk encryption settings?"</div>
                </div>
              </div>
              
              <div className="flex items-start gap-4 relative">
                <div className="w-12 h-12 rounded-lg bg-surface-container-high border border-outline-variant flex items-center justify-center shrink-0 z-10">
                  <span className="material-symbols-outlined text-outline" style={{ fontVariationSettings: "'FILL' 0" }}>image</span>
                </div>
                <div className="glass-panel p-3 w-full flex flex-col gap-2 border-[0.5px]">
                  <div className="font-code-label text-[12px] text-outline">MANUAL_EVIDENCE.png</div>
                  <div className="h-16 w-full bg-surface-container-lowest border border-outline-variant/50 rounded flex items-center justify-center relative overflow-hidden group/img">
                    <div className="absolute inset-0 backdrop-blur-[2px] bg-background/50 z-10 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity">
                      <span className="font-code-label text-[12px] text-error">UNVERIFIED</span>
                    </div>
                    <div className="w-3/4 h-2 bg-surface-bright rounded-full opacity-30"></div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-start gap-4 relative">
                <div className="w-12 h-12 rounded-lg bg-surface-container-high border border-outline-variant flex items-center justify-center shrink-0 z-10 relative">
                  <span className="material-symbols-outlined text-outline" style={{ fontVariationSettings: "'FILL' 0" }}>pending_actions</span>
                </div>
                <div className="glass-panel p-4 w-full border-[0.5px]">
                  <div className="font-code-label text-[12px] text-outline mb-1">Compliance_v4_FINAL.csv</div>
                  <div className="flex items-center justify-between">
                    <span className="font-body-sm text-body-sm text-on-surface-variant">Manual Review</span>
                    <span className="font-code-label text-[10px] text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded">DELAYED</span>
                  </div>
                </div>
              </div>
              
              <div className="ml-16 pt-4 border-t border-outline-variant/30 border-dashed">
                <div className="inline-flex items-center gap-2 bg-surface-container-high border-[0.5px] border-outline-variant rounded-full px-4 py-2">
                  <span className="material-symbols-outlined text-error text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                  <span className="font-code-label text-[12px] text-on-surface-variant">Compliance Uncertainty</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="hidden lg:flex flex-col items-center justify-center relative w-8 z-20">
            <div className="w-px h-full bg-outline-variant/50 relative">
              <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 bg-surface px-2 py-4 border-[0.5px] border-outline-variant rounded-full text-center">
                <span className="material-symbols-outlined text-outline text-sm" style={{ fontVariationSettings: "'FILL' 0" }}>swap_horiz</span>
              </div>
            </div>
          </div>
          
          <div className="lg:hidden my-8 relative z-20 flex justify-center w-full bg-[repeating-linear-gradient(90deg,var(--tw-colors-outline-variant)_0px,var(--tw-colors-outline-variant)_4px,transparent_4px,transparent_8px)] h-px">
            <div className="absolute top-1/2 -translate-y-1/2 bg-surface px-4 py-1 border-[0.5px] border-outline-variant rounded-full">
              <span className="material-symbols-outlined text-outline text-sm" style={{ fontVariationSettings: "'FILL' 0" }}>swap_vert</span>
            </div>
          </div>
          
          <div className="flex-1 flex flex-col items-center lg:items-start relative z-10">
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" xmlns="http://www.w3.org/2000/svg">
              <path className="animate-dash-fast opacity-50" d="M 24 60 L 24 350" fill="none" stroke="#064e3b" strokeWidth="1.5" />
            </svg>
            
            <div className="font-code-label text-[12px] text-secondary mb-8 uppercase tracking-widest flex items-center gap-2 bg-[#064e3b]/20 px-3 py-1 rounded-full border border-secondary/30">
              <span className="w-2 h-2 rounded-full bg-secondary pulse-heartbeat-anim"></span> Continuous Verification Path
            </div>
            
            <div className="space-y-12 w-full max-w-sm relative">
              <div className="flex items-start gap-4 relative">
                <div className="w-12 h-12 rounded-lg bg-surface-container border-[0.5px] border-[#064e3b]/30 flex items-center justify-center shrink-0 z-10 relative overflow-hidden shadow-[0_0_15px_rgba(6,78,59,0.1)]">
                  <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 0" }}>memory</span>
                </div>
                <div className="terminal-panel p-3 w-full font-log-tiny text-[10px] border-[0.5px] hover-elevate">
                  <div className="flex justify-between items-center mb-2 pb-2 border-b border-outline-variant/30">
                    <span className="text-outline">agent_v2.4.1</span>
                    <span className="text-secondary flex items-center gap-1"><span className="w-1.5 h-1.5 bg-secondary rounded-full pulse-heartbeat-anim"></span> active</span>
                  </div>
                  <div className="text-on-surface-variant opacity-80">
                    &gt; init hardware_attestation<br />
                    &gt; TPM 2.0 module detected
                  </div>
                </div>
              </div>
              
              <div className="flex items-start gap-4 relative">
                <div className="w-12 h-12 rounded-lg bg-surface-container border-[0.5px] border-[#064e3b]/30 flex items-center justify-center shrink-0 z-10 relative overflow-hidden shadow-[0_0_15px_rgba(6,78,59,0.1)]">
                  <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 0" }}>account_tree</span>
                </div>
                <div className="terminal-panel p-3 w-full font-log-tiny text-[10px] border-[0.5px] hover-elevate">
                  <div className="text-primary-fixed-dim border-b-[0.5px] border-outline-variant/30 pb-1 mb-1">eval_engine</div>
                  <div className="text-on-surface-variant opacity-80 font-log-tiny text-[9px] leading-relaxed">
                    <span className="text-secondary">info:</span> parsing policy ast...<br />
                    <span className="text-secondary">info:</span> querying local state db...<br />
                    <span className="text-secondary-fixed">eval:</span> [disk.encrypted == true] -&gt; <span className="text-[#34d399]">PASS</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-start gap-4 relative">
                <div className="w-12 h-12 rounded-lg bg-surface-container border-[0.5px] border-[#064e3b]/30 flex items-center justify-center shrink-0 z-10 relative overflow-hidden shadow-[0_0_15px_rgba(6,78,59,0.1)]">
                  <div className="absolute inset-0 flex flex-col items-start justify-center pl-1 pt-1 opacity-20 font-log-tiny text-[5px] text-outline leading-tight overflow-hidden">
                    kind: CompliancePolicy<br />
                    spec:<br />
                    &nbsp;&nbsp;target: all<br />
                    &nbsp;&nbsp;rules:<br />
                    &nbsp;&nbsp;&nbsp;&nbsp;- tpm20<br />
                    &nbsp;&nbsp;&nbsp;&nbsp;- fde
                  </div>
                  <span className="material-symbols-outlined text-secondary relative z-10 text-[18px]" style={{ fontVariationSettings: "'FILL' 0" }}>description</span>
                </div>
                <div className="terminal-panel p-3 w-full font-log-tiny text-[10px] relative overflow-hidden border-[0.5px] hover-elevate">
                  <div className="text-primary-fixed-dim border-b-[0.5px] border-outline-variant/30 pb-1 mb-1">policy.yaml</div>
                  <div className="text-on-surface-variant opacity-80 mt-1 pl-2 border-l-[0.5px] border-outline-variant/50">
                    require_encryption: true<br />
                    verify_boot: strict
                  </div>
                </div>
              </div>
              
              <div className="flex items-start gap-4 relative transition-all duration-500 ease-in-out hover:scale-105">
                <div className="w-12 h-12 rounded-lg bg-[#064e3b]/10 border-[0.5px] border-secondary flex items-center justify-center shrink-0 z-10 relative shadow-[0_0_20px_rgba(6,78,59,0.4)]">
                  <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                </div>
                <div className="glass-panel border-secondary/50 p-4 w-full border-[0.5px] bg-secondary/5 shadow-[0_0_20px_rgba(78,222,163,0.1)]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-code-label text-[10px] text-secondary">REAL-TIME STATE</span>
                  </div>
                  <div className="flex items-end gap-2">
                    <span className="font-display-lg-mobile text-display-lg-mobile text-on-surface text-transparent bg-clip-text bg-gradient-to-r from-secondary to-primary-fixed-dim">100%</span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant pb-1">Compliant</span>
                  </div>
                </div>
              </div>
              
              <div className="ml-16 pt-4 border-t border-[#064e3b]/30 border-dashed relative">
                <div className="inline-flex items-center gap-2 bg-[#064e3b]/10 border-[0.5px] border-secondary rounded-full px-4 py-2 shadow-[0_0_10px_rgba(78,222,163,0.2)]">
                  <span className="material-symbols-outlined text-secondary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>security</span>
                  <span className="font-code-label text-[12px] text-secondary font-semibold">Audit Ready</span>
                </div>
              </div>
            </div>
          </div>
          
        </div>
      </section>

      {/* 5. Technical Chapter (Architecture) */}
      <section id="architecture" className="max-w-container-max mx-auto w-full px-margin-desktop relative z-10 mb-[240px] blueprint-grid pt-16 reveal">
        <div className="text-center mb-20">
          <h2 className="font-display-lg text-display-lg-mobile md:text-display-lg text-on-surface mb-6">Architected for Privacy.</h2>
          <p className="font-headline-md text-headline-md text-on-surface-variant max-w-2xl mx-auto leading-relaxed">
            Verification happens where the code lives. Only the results travel to the cloud.
          </p>
        </div>
        
        <div className="relative w-full max-w-6xl mx-auto min-h-[700px] flex flex-col md:flex-row items-center justify-between gap-12 md:gap-0">
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-outline-variant/30 -translate-x-1/2 z-0 border-l-[2px] border-dashed border-secondary/40 hidden md:block">
            <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-surface-dim px-4 py-2 border border-secondary/50 rounded-full text-[#34d399] font-code-label text-[13px] tracking-widest uppercase whitespace-nowrap shadow-[0_0_15px_rgba(6,78,59,0.3)] bg-[#064e3b]/10">
              Privacy Boundary
            </div>
            <div className="absolute top-1/2 -translate-y-1/2 left-[-150px] w-[300px] h-px bg-outline-variant/20">
              <div className="packet-h bg-secondary shadow-[0_0_12px_#34d399]"></div>
              <div className="packet-h bg-secondary shadow-[0_0_12px_#34d399] delay-1"></div>
              <div className="packet-h bg-secondary shadow-[0_0_12px_#34d399] delay-2"></div>
            </div>
          </div>
          
          <div className="w-full md:w-[45%] h-full flex flex-col justify-center relative md:pr-12">
            <div className="mb-6 text-left md:text-right">
              <span className="font-code-label text-[13px] text-on-surface-variant tracking-wider uppercase">Local Boundary</span>
            </div>
            <div className="unified-card bg-surface-container-lowest p-8 relative group transition-all duration-300 hover-elevate border-outline-variant/50">
              <div className="flex items-center gap-3 mb-8 border-b-[0.5px] border-outline-variant/50 pb-4">
                <span className="material-symbols-outlined text-primary text-[28px]">computer</span>
                <h3 className="font-headline-md text-[20px] font-semibold text-on-surface">Developer Workstation</h3>
              </div>
              <div className="terminal-panel p-5 mb-8 relative overflow-hidden border-[0.5px]">
                <div className="flex items-center justify-between mb-4 border-b-[0.5px] border-outline-variant/30 pb-2">
                  <span className="font-code-label text-[11px] text-on-surface-variant">Source Code (Local Only)</span>
                  <span className="material-symbols-outlined text-outline text-[18px]">lock</span>
                </div>
                <div className="font-log-tiny text-[11px] text-on-surface opacity-90 leading-relaxed">
                  <span className="text-tertiary-container">func</span> validateIdentity(token string) (<span className="text-secondary-fixed">bool</span>, error) &#123;<br />
                  &nbsp;&nbsp;claims, err := parse(token)<br />
                  &nbsp;&nbsp;<span className="text-error">if</span> err != nil &#123; return false, err &#125;<br />
                  &nbsp;&nbsp;return true, nil<br />
                  &#125;
                </div>
              </div>
              <div className="flex items-center gap-4 p-5 rounded-lg bg-surface-container-high border-[0.5px] border-outline-variant/60 relative overflow-hidden shadow-inner">
                <div className="relative w-12 h-12 flex items-center justify-center bg-surface-container-lowest rounded-full border-[0.5px] border-[#064e3b]/20">
                  <span className="absolute inset-0 rounded-full border-2 border-secondary pulse-heartbeat-anim"></span>
                  <span className="material-symbols-outlined text-secondary text-[20px]">shield_person</span>
                </div>
                <div className="flex-1">
                  <h4 className="font-code-label text-[13px] text-on-surface mb-1.5">Local Go Agent</h4>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-secondary pulse-heartbeat-anim"></span>
                    <span className="font-log-tiny text-[11px] text-on-surface-variant">Kernel 6.8.0 • Active</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="w-full md:w-[45%] h-full flex flex-col justify-center relative md:pl-12">
            <div className="mb-6 text-left">
              <span className="font-code-label text-[13px] text-on-surface-variant tracking-wider uppercase">Cloud Infrastructure</span>
            </div>
            <div className="unified-card p-8 relative group transition-all duration-300 border-[#064e3b]/40 shadow-[0_0_25px_rgba(6,78,59,0.15)] hover-elevate bg-surface-container-low/90">
              <div className="flex items-center gap-3 mb-8 border-b-[0.5px] border-outline-variant/50 pb-4">
                <span className="material-symbols-outlined text-secondary text-[28px]">cloud</span>
                <h3 className="font-headline-md text-[20px] font-semibold text-on-surface">Secure API &amp; Dashboard</h3>
              </div>
              <div className="flex items-center gap-4 p-5 mb-8 rounded-lg bg-surface-container-high border-[0.5px] border-outline-variant/60 shadow-inner">
                <div className="w-12 h-12 flex items-center justify-center bg-surface-container-lowest rounded-lg border-[0.5px] border-outline-variant">
                  <span className="material-symbols-outlined text-tertiary-container text-[20px]">api</span>
                </div>
                <div>
                  <h4 className="font-code-label text-[13px] text-on-surface mb-1.5">Telemetry Ingestion API</h4>
                  <span className="font-log-tiny text-[11px] text-on-surface-variant">Receives verified states only</span>
                </div>
              </div>
              <div className="bg-surface-container-lowest border-[0.5px] border-outline-variant rounded-lg p-5">
                <div className="font-code-label text-[11px] text-on-surface-variant mb-4 border-b-[0.5px] border-outline-variant/50 pb-2">Audit Timeline</div>
                <div className="space-y-4">
                  <div className="flex items-start gap-3 opacity-100">
                    <span className="material-symbols-outlined text-[#34d399] text-[16px] mt-0.5">check_circle</span>
                    <div>
                      <div className="font-code-label text-[13px] text-on-surface mb-0.5">Verification Passed</div>
                      <div className="font-log-tiny text-[11px] text-outline">Node: eng-ws-042 • Policy: core-v2</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 opacity-60">
                    <span className="material-symbols-outlined text-[#34d399] text-[16px] mt-0.5">sync</span>
                    <div>
                      <div className="font-code-label text-[13px] text-on-surface mb-0.5">Policy Sync</div>
                      <div className="font-log-tiny text-[11px] text-outline">Latest ruleset downloaded</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
        </div>
      </section>

      {/* 6. Technical Chapter (Policy Proof) */}
      <section className="w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-16 relative z-10 mb-[240px] reveal">
        <div className="mb-20 max-w-2xl mx-auto text-center">
          <h2 className="font-display-lg-mobile md:font-display-lg text-primary mb-6 leading-tight">Policy as Code:<br />Your Infrastructure, Verified.</h2>
          <p className="text-on-surface-variant font-body-base text-body-base max-w-xl mx-auto text-lg leading-relaxed">
            Define security assertions in plain YAML. Our Go evaluation engine continuously audits state against intent, ensuring zero-drift compliance. Security is now just a git-commit away.
          </p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 relative items-center">
          <div className="lg:col-span-7 terminal-panel overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative z-20 border-[0.5px] hover-elevate" style={{ transform: "translateZ(20px)" }}>
            <div className="bg-surface-container flex items-center px-4 py-3 border-b-[0.5px] border-outline-variant">
              <div className="flex gap-2 mr-4">
                <div className="w-3 h-3 rounded-full bg-[#ff5f56]"></div>
                <div className="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
                <div className="w-3 h-3 rounded-full bg-[#27c93f]"></div>
              </div>
              <div className="flex items-center gap-2 bg-terminal-black px-4 py-1.5 rounded-t-lg border-t-[0.5px] border-x-[0.5px] border-outline-variant border-b-0 text-on-surface font-code-label text-[12px] mt-2">
                <span className="material-symbols-outlined text-sm">description</span> policy.yaml
              </div>
            </div>
            <div className="p-6 font-log-tiny text-[13px] overflow-x-auto pb-16 relative bg-[#0e0e11]">
              <table className="w-full text-left border-collapse">
                <tbody>
                  <tr>
                    <td className="text-outline-variant/50 pr-4 select-none w-8 text-right border-r border-outline-variant/20 mr-4">1</td>
                    <td className="whitespace-pre pl-4"><span className="text-outline"># Standard Infrastructure Policy V2</span></td>
                  </tr>
                  <tr>
                    <td className="text-outline-variant/50 pr-4 select-none text-right border-r border-outline-variant/20 mr-4">2</td>
                    <td className="whitespace-pre pl-4"><span className="text-primary-fixed-dim">apiVersion</span>: <span className="text-secondary">flientsec.io/v1</span></td>
                  </tr>
                  <tr>
                    <td className="text-outline-variant/50 pr-4 select-none text-right border-r border-outline-variant/20 mr-4">3</td>
                    <td className="whitespace-pre pl-4"><span className="text-primary-fixed-dim">kind</span>: <span className="text-secondary">CompliancePolicy</span></td>
                  </tr>
                  <tr>
                    <td className="text-outline-variant/50 pr-4 select-none text-right border-r border-outline-variant/20 mr-4">4</td>
                    <td className="whitespace-pre pl-4"><span className="text-primary-fixed-dim">metadata</span>:</td>
                  </tr>
                  <tr>
                    <td className="text-outline-variant/50 pr-4 select-none text-right border-r border-outline-variant/20 mr-4">5</td>
                    <td className="whitespace-pre pl-4">  <span className="text-primary-fixed-dim">name</span>: <span className="text-secondary">core-security-baseline</span></td>
                  </tr>
                  <tr>
                    <td className="text-outline-variant/50 pr-4 select-none text-right border-r border-outline-variant/20 mr-4">6</td>
                    <td className="whitespace-pre pl-4"><span className="text-primary-fixed-dim">spec</span>:</td>
                  </tr>
                  <tr>
                    <td className="text-outline-variant/50 pr-4 select-none text-right border-r border-outline-variant/20 mr-4">7</td>
                    <td className="whitespace-pre pl-4">  <span className="text-primary-fixed-dim">targets</span>:</td>
                  </tr>
                  <tr>
                    <td className="text-outline-variant/50 pr-4 select-none text-right border-r border-outline-variant/20 mr-4">8</td>
                    <td className="whitespace-pre pl-4">    - <span className="text-primary-fixed-dim">label</span>: <span className="text-secondary">env=production</span></td>
                  </tr>
                  <tr>
                    <td className="text-outline-variant/50 pr-4 select-none text-right border-r border-outline-variant/20 mr-4">9</td>
                    <td className="whitespace-pre pl-4">  <span className="text-primary-fixed-dim">assertions</span>:</td>
                  </tr>
                  <tr>
                    <td className="text-outline-variant/50 pr-4 select-none text-right border-r border-outline-variant/20 mr-4">10</td>
                    <td className="whitespace-pre pl-4">    <span className="text-outline"># Require Full Disk Encryption</span></td>
                  </tr>
                  <tr>
                    <td className="text-outline-variant/50 pr-4 select-none text-right border-r border-outline-variant/20 mr-4">11</td>
                    <td className="whitespace-pre pl-4">    - <span className="text-primary-fixed-dim">name</span>: <span className="text-secondary">disk_encryption</span></td>
                  </tr>
                  <tr>
                    <td className="text-outline-variant/50 pr-4 select-none text-right border-r border-outline-variant/20 mr-4">12</td>
                    <td className="whitespace-pre pl-4">      <span className="text-primary-fixed-dim">condition</span>: <span className="text-secondary">volume.encrypted == true</span></td>
                  </tr>
                </tbody>
              </table>
              <div className="absolute bottom-4 right-4 flex items-center gap-3 bg-surface-container-high/80 border-[0.5px] border-outline-variant/50 px-3 py-1.5 rounded-md font-code-label text-[11px] text-on-surface-variant backdrop-blur-md shadow-lg">
                <span className="material-symbols-outlined text-[14px]">merge_type</span> main
                <span className="w-px h-3 bg-outline-variant/50"></span>
                <span className="material-symbols-outlined text-[14px]">commit</span> commit: 8f2a1b
              </div>
            </div>
          </div>
          
          <div className="lg:col-span-5 flex flex-col justify-center gap-8 relative z-10 h-full">
            <div className="unified-card p-5 flex items-center gap-4 relative bg-surface-container-low hover-elevate">
              <div className="w-12 h-12 rounded-lg bg-terminal-black border-[0.5px] border-outline-variant flex items-center justify-center shadow-inner">
                <span className="material-symbols-outlined text-secondary text-[24px]">memory</span>
              </div>
              <div>
                <h3 className="font-code-label text-[13px] text-primary mb-1">Go Evaluation Engine</h3>
                <p className="font-log-tiny text-[11px] text-on-surface-variant">Real-time continuous verification</p>
              </div>
            </div>
            
            <div className="unified-card p-8 shadow-[0_20px_40px_rgba(0,0,0,0.4)] relative hover-elevate border-secondary/30 bg-surface-dim/90" style={{ transform: "translateZ(30px)" }}>
              <div className="flex justify-between items-start mb-8 border-b-[0.5px] border-outline-variant/50 pb-5">
                <div>
                  <h2 className="font-headline-md text-[20px] text-primary mb-2">Compliance Result</h2>
                  <p className="font-code-label text-[12px] text-on-surface-variant">Target: env=production</p>
                </div>
                <div className="bg-[#064e3b]/20 border-[0.5px] border-secondary text-[#34d399] px-4 py-1.5 rounded flex items-center gap-2 font-code-label text-[12px] shadow-[0_0_15px_rgba(6,78,59,0.2)]">
                  <div className="w-2 h-2 rounded-full bg-[#34d399] pulse-heartbeat-anim"></div> COMPLIANT
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-surface-container-lowest p-4 rounded-lg border-[0.5px] border-outline-variant/50">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-secondary text-[18px]">lock</span>
                    <span className="font-code-label text-[13px] text-on-surface">Disk Encryption</span>
                  </div>
                  <span className="font-log-tiny text-[11px] text-[#34d399] font-medium">Verified</span>
                </div>
                <div className="flex justify-between items-center bg-surface-container-lowest p-4 rounded-lg border-[0.5px] border-outline-variant/50">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-secondary text-[18px]">security</span>
                    <span className="font-code-label text-[13px] text-on-surface">TPM 2.0 Status</span>
                  </div>
                  <span className="font-log-tiny text-[11px] text-[#34d399] font-medium">Active</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Trust / Privacy Chapter */}
      <section className="max-w-container-max mx-auto px-margin-desktop relative mb-[120px] reveal">
        <div className="text-center mb-20 relative z-10">
          <h2 className="font-display-lg-mobile md:font-display-lg text-on-surface mb-6">Privacy by Design</h2>
          <p className="font-body-base text-body-base text-on-surface-variant max-w-2xl mx-auto text-lg leading-relaxed">
            Engineering-grade security guarantees that sensitive local workstation data never traverses the boundary to our cloud infrastructure.
          </p>
        </div>
        
        <div className="relative w-full max-w-6xl mx-auto min-h-[600px] flex flex-col md:flex-row items-stretch justify-between gap-10 md:gap-0 mt-12 perspective-[1200px]">
          <div className="flex-1 relative z-10">
            <div className="unified-card p-8 h-full shadow-2xl relative overflow-hidden group hover-elevate">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-40 bg-status-error/10 blur-[50px] pointer-events-none"></div>
              <div className="flex items-center gap-3 mb-10 border-b-[0.5px] border-outline-variant/50 pb-5">
                <span className="material-symbols-outlined text-status-error text-[28px]">desktop_windows</span>
                <h2 className="font-headline-md text-[20px] text-on-surface">Local Workstation</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="bg-surface-container-highest/50 border-[0.5px] border-outline/30 rounded-lg p-5 relative overflow-hidden shadow-inner">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-outline text-[18px]">code</span>
                      <span className="font-code-label text-[13px] text-on-surface">Source code</span>
                    </div>
                    <span className="px-2 py-1 rounded bg-status-error/20 text-status-error font-log-tiny text-[10px] uppercase tracking-wider font-semibold">Stay Local</span>
                  </div>
                </div>
                
                <div className="bg-surface-container-highest/50 border-[0.5px] border-outline/30 rounded-lg p-5 relative overflow-hidden shadow-inner">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-outline text-[18px]">key</span>
                      <span className="font-code-label text-[13px] text-on-surface">Passwords</span>
                    </div>
                    <span className="px-2 py-1 rounded bg-status-error/20 text-status-error font-log-tiny text-[10px] uppercase tracking-wider font-semibold">Stay Local</span>
                  </div>
                </div>
                
                <div className="bg-surface-container-highest/50 border-[0.5px] border-outline/30 rounded-lg p-5 relative overflow-hidden shadow-inner sm:col-span-2">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-outline text-[18px]">history</span>
                      <span className="font-code-label text-[13px] text-on-surface">Browser History</span>
                    </div>
                    <span className="px-2 py-1 rounded bg-status-error/20 text-status-error font-log-tiny text-[10px] uppercase tracking-wider font-semibold">Stay Local</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="relative md:w-40 flex flex-col items-center justify-center shrink-0 hidden md:flex">
            <div className="absolute top-0 bottom-0 w-[2px] bg-outline-variant/30 [background-image:linear-gradient(to_bottom,var(--tw-colors-outline-variant)_50%,transparent_50%)] [background-size:2px_24px] z-0"></div>
            <div className="absolute top-1/2 -translate-y-1/2 bg-surface-dim border-[0.5px] border-outline-variant rounded-full p-3 z-20 shadow-[0_0_30px_rgba(0,0,0,0.8)]">
              <span className="material-symbols-outlined text-primary text-[24px]">shield_lock</span>
            </div>
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-10 w-full">
              <div className="packet-animation absolute w-5 h-5 rounded-full bg-[#34d399] shadow-[0_0_15px_#34d399] flex items-center justify-center left-0">
                <span className="material-symbols-outlined text-[12px] text-[#002114]">check</span>
              </div>
              <div className="packet-animation absolute w-4 h-4 rounded-full bg-[#34d399] shadow-[0_0_10px_#34d399] left-0"></div>
              <div className="packet-animation absolute w-6 h-6 rounded-full border-[0.5px] border-[#34d399] bg-[#34d399]/20 flex items-center justify-center left-0">
                <span className="material-symbols-outlined text-[14px] text-[#34d399]">data_usage</span>
              </div>
            </div>
          </div>
          
          <div className="flex-1 relative z-10">
            <div className="unified-card p-8 h-full shadow-2xl relative overflow-hidden hover-elevate">
              <div className="absolute top-0 right-1/2 translate-x-1/2 w-3/4 h-40 bg-[#064e3b]/10 blur-[50px] pointer-events-none"></div>
              <div className="flex items-center gap-3 mb-10 border-b-[0.5px] border-outline-variant/50 pb-5">
                <span className="material-symbols-outlined text-[#34d399] text-[28px]">cloud</span>
                <h2 className="font-headline-md text-[20px] text-on-surface">FlientSec Cloud</h2>
              </div>
              <div className="flex flex-col gap-6">
                <div className="terminal-panel overflow-hidden shadow-lg border-[0.5px]">
                  <div className="bg-surface-container-highest px-4 py-3 border-b-[0.5px] border-outline-variant flex items-center gap-2">
                    <span className="material-symbols-outlined text-outline text-[16px]">monitoring</span>
                    <span className="font-code-label text-[13px] text-on-surface-variant">Global Telemetry</span>
                  </div>
                  <div className="p-5 font-log-tiny text-[11px] text-secondary/80">
                    <div className="flex items-center gap-2 mb-2"><span className="w-1.5 h-1.5 rounded-full bg-[#34d399] pulse-heartbeat-anim"></span> [SYS] Telemetry stream verified</div>
                    <div className="text-on-surface-variant opacity-60 ml-3.5 mb-4">&gt; Payload encrypted at rest</div>
                    <div className="bg-surface-container-lowest/80 p-4 rounded-lg border-[0.5px] border-outline-variant/40 ml-3.5">
                      <div className="text-outline mb-2 font-semibold font-code-label text-[12px]">Sanitized Metadata Preview:</div>
                      <div className="text-primary-fixed-dim bg-[#0e0e11] p-3 rounded border border-outline-variant/20 font-log-tiny text-[11px]">
                        &#123;<br />
                        &nbsp;&nbsp;<span className="text-secondary">"id"</span>: <span className="text-tertiary-container">"a8f93-4b2c-901d"</span>,<br />
                        &nbsp;&nbsp;<span className="text-secondary">"status"</span>: <span className="text-tertiary-container">"verified"</span>,<br />
                        &nbsp;&nbsp;<span className="text-secondary">"metadata"</span>: <span className="text-tertiary-container">"anonymized"</span>,<br />
                        &nbsp;&nbsp;<span className="text-secondary">"policy_id"</span>: <span className="text-tertiary-container">"core-security-baseline"</span>,<br />
                        &nbsp;&nbsp;<span className="text-secondary">"timestamp"</span>: <span className="text-tertiary-container">"2024-05-20T14:02:02Z"</span><br />
                        &#125;
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. FAQ Objections Accordion Section (V1 Preservation - Styled as a cohesive card) */}
      <section className="max-w-4xl mx-auto px-margin-mobile md:px-margin-desktop py-8 relative z-10 mb-[120px] reveal">
        <div className="unified-card p-8 md:p-12 bg-surface-container-low/60 backdrop-blur-md">
          <div className="text-center mb-12">
            <span className="font-code-label text-[13px] text-primary tracking-wider uppercase">FAQ</span>
            <h2 className="font-display-lg-mobile md:font-display-lg text-on-surface mt-2 mb-4">Common Objections</h2>
          </div>
          <div className="divide-y divide-outline-variant/30 border-t border-b border-outline-variant/30">
            {faqData.map((item, idx) => (
              <div key={idx} className="py-6">
                <button 
                  onClick={() => toggleFaq(idx)}
                  className="w-full flex items-center justify-between text-left font-bold text-on-surface text-[18px] font-headline-md focus:outline-none"
                >
                  <span className="font-headline-md text-[18px]">{item.q}</span>
                  <span className={`material-symbols-outlined text-outline transform transition-transform duration-200 ${openFaq === idx ? "rotate-180" : "rotate-0"}`}>
                    expand_more
                  </span>
                </button>
                {openFaq === idx && (
                  <p className="mt-4 text-sm text-on-surface-variant leading-relaxed font-normal transition-all duration-300">
                    {item.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 9. Final CTA */}
      <section id="cta" className="flex items-center justify-center min-h-[700px] relative pb-32 reveal">
        <div className="absolute inset-0 blueprint-grid pointer-events-none opacity-30"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(6,78,59,0.15)_0%,transparent_60%)] pulse-heartbeat-anim pointer-events-none mix-blend-screen"></div>
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop w-full relative z-10">
          <div className="flex flex-col gap-10 md:gap-14 items-center text-center">
            <div className="flex flex-col gap-8 items-center">
              <div className="inline-flex items-center gap-3 bg-[#064e3b]/10 px-4 py-1.5 rounded-full border border-[#064e3b]/30">
                <div className="w-2 h-2 rounded-full bg-[#34d399] pulse-heartbeat-anim shadow-[0_0_10px_#34d399]"></div>
                <span className="font-code-label text-[13px] text-[#34d399] tracking-widest uppercase font-semibold">Infrastructure Integrity</span>
              </div>
              <h2 className="font-display-lg-mobile md:font-display-lg text-on-surface leading-tight max-w-4xl">
                Secure every engineering workstation.<br />
                <span className="text-primary opacity-90">Without surveillance.</span>
              </h2>
            </div>
            
            <p className="font-body-base text-body-base text-on-surface-variant max-w-2xl text-lg md:text-xl leading-relaxed">
              Built for teams that value developer trust. Start verifying your infrastructure with continuous, privacy-first compliance.
            </p>
            
            <div className="pt-6 flex flex-col sm:flex-row gap-6 items-center">
              <button 
                onClick={() => alert("Thank you for requesting early access! Our design partner coordinators will contact you.")}
                className="bg-primary text-on-primary font-headline-md text-lg px-10 py-5 rounded-[8px] border-[0.5px] border-primary hover:bg-primary-fixed flex items-center gap-3 shadow-[0_8px_20px_rgba(225,223,255,0.15)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_25px_rgba(225,223,255,0.25)]"
              >
                Request Access
                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </button>
              <div className="flex items-center gap-3 pl-2 sm:pl-6 opacity-70">
                <span className="material-symbols-outlined text-on-surface-variant text-[24px]">terminal</span>
                <span className="font-code-label text-[13px] text-on-surface-variant">CLI-first deployment</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 10. Footer */}
      <footer className="w-full bg-surface-container-lowest border-t-[0.5px] border-outline-variant z-20 relative pt-16 pb-8">
        <div className="max-w-container-max mx-auto px-margin-desktop">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-16">
            <div className="col-span-2">
              <div className="font-headline-md text-headline-md font-bold text-on-surface flex items-center gap-2 mb-4">
                <img src="/logo_light.png" alt="FlientSec Logo" className="h-6 w-6 object-contain" />
                FlientSec
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant max-w-xs mb-6 leading-relaxed">
                Engineering-grade device identity and posture verification built on zero-trust principles.
              </p>
            </div>
            
            <div>
              <h4 className="font-code-label text-[13px] text-on-surface mb-4 font-semibold uppercase tracking-wider">Product</h4>
              <ul className="space-y-3 font-body-sm text-body-sm text-on-surface-variant">
                <li><a className="hover:text-primary transition-colors" href="#">Features</a></li>
                <li><a className="hover:text-primary transition-colors" href="#architecture">Architecture</a></li>
                <li><Link className="hover:text-primary transition-colors" href="/dashboard">Demo Console</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-code-label text-[13px] text-on-surface mb-4 font-semibold uppercase tracking-wider">Resources</h4>
              <ul className="space-y-3 font-body-sm text-body-sm text-on-surface-variant">
                <li><Link className="hover:text-primary transition-colors" href="/dashboard">Documentation</Link></li>
                <li>
                  <a 
                    className="hover:text-primary transition-colors flex items-center gap-1.5" 
                    href="https://github.com/Rarebuffalo/Flientsec" 
                    target="_blank" 
                    rel="noreferrer"
                  >
                    GitHub
                  </a>
                </li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-code-label text-[13px] text-on-surface mb-4 font-semibold uppercase tracking-wider">Company</h4>
              <ul className="space-y-3 font-body-sm text-body-sm text-on-surface-variant">
                <li><span className="text-slate-400 font-medium cursor-default">About</span></li>
                <li><span className="text-slate-400 font-medium cursor-default">Privacy</span></li>
                <li><span className="text-slate-400 font-medium cursor-default">Security</span></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t-[0.5px] border-outline-variant/50 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="font-body-sm text-body-sm text-[#064e3b]">
              © 2026 FlientSec Inc. All rights reserved.
            </div>
            <div className="flex items-center gap-4">
              <span className="material-symbols-outlined text-[20px] text-on-surface-variant">public</span>
            </div>
          </div>
        </div>
      </footer>

    </div>
  )
}
