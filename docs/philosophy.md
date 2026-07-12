# Product Philosophy

FlientSec was built to solve the modern workstation compliance challenge for engineering teams. Here is why we designed the platform the way we did.

---

## 1. Why Not Traditional MDMs?

Mobile Device Management (MDM) platforms were designed for corporate IT environments, not modern developer setups:
- **Intrusive Profiles:** MDMs require installing root configurations that block environment variables, restrict compiler ports, and slow down development loops.
- **Privacy Intrusion:** Traditional IT tools monitor browsing history, track screens, and scan source files, creating friction and distrust.
- **Poor Linux Support:** Platforms like Jamf or Microsoft Intune offer limited Linux functionality, leaving developer setups unverified.

---

## 2. Why Linux First?

Linux environments (Arch, Ubuntu, Fedora) represent a significant portion of developer workstations, yet they are underserved by standard compliance solutions:
- **Frictionless Verification:** By starting with Linux, we solve the hardest workstation platform verification environment first.
- **Open and Extensible:** A modular agent allows security teams to verify package updates and encryption parameters without complex toolchains.

---

## 3. Local Evaluation & Data Minimization

We follow a strict telemetry-only approach:
- **Privacy by Design:** Security checks are parsed and calculated entirely on the client workstation.
- **Zero Content Leakage:** We do not index source code repositories, scan private directories, or track activity. Only the computed compliance score is transmitted to the cloud.
