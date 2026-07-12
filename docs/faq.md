# Frequently Asked Questions

This guide addresses common questions and objections about the FlientSec platform.

---

## 1. Product Context & Objectives

### Why Linux first?
Linux-first allows us to solve one of the least served workstation security markets before expanding to additional operating systems. Developer setups on Arch, Ubuntu, and Fedora are often left out of traditional IT security policies due to lack of agent compatibility. FlientSec fixes this gap native to Linux configurations.

### Why not use Microsoft Intune or Jamf?
Traditional MDM platforms require intrusive device configuration profiles that lock down user settings, block developer tools, and are famously difficult to deploy on Linux environments. Furthermore, they often monitor arbitrary user activity. FlientSec is lightweight, non-intrusive, evaluates policies strictly local to the machine via YAML, and respects developer privacy.

---

## 2. Telemetry & Transport

### Does FlientSec read or collect my source code?
No. The agent checks security properties—like disk encryption, local SSH port settings, and package manager versions. It does not scan, index, read, or upload any source code, repository directories, browser histories, or keyboard inputs.

### Does it work offline?
Yes. If a workstation is offline, the Go agent continues to execute local checks at the scheduled interval. Telemetry reports cache inside an in-memory queue and are flushed to the cloud portal immediately when the workstation reconnects to the network.
