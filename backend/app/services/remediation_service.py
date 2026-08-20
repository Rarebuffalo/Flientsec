"""
Remediation Guidance Service for FlientSec Security Findings.

Provides authoritative, OS-specific remediation and verification instructions
for all security rules evaluated by the Go security daemon.
"""
from typing import Optional
from app.schemas import schemas


def get_remediation_guidance(
    rule_id: str,
    check_name: str,
    observed_reason: Optional[str] = None
) -> schemas.RemediationGuidanceResponse:
    """
    Returns structured remediation guidance tailored to the security rule.
    """
    norm_rule = rule_id.lower()

    if "firewall" in norm_rule:
        return schemas.RemediationGuidanceResponse(
            rule_id=rule_id,
            title="Enable and Configure Host Firewall",
            why_it_matters=(
                "Host firewalls restrict unauthorized inbound connections, block port scans, "
                "and prevent lateral movement across enterprise networks in the event of an endpoint compromise."
            ),
            expected_state="Host firewall service (UFW, Firewalld, or NFTables) must be active and enforcing rules.",
            observed_state=observed_reason or "Firewall daemon is inactive or not loaded.",
            os_guidance=[
                schemas.RemediationCommandGuidance(
                    os_name="Ubuntu / Debian",
                    remediation_cmd=(
                        "sudo ufw default deny incoming && sudo ufw default allow outgoing && sudo ufw enable"
                    ),
                    verification_cmd="sudo ufw status verbose",
                    notes="UFW will configure the standard persistent firewall ruleset."
                ),
                schemas.RemediationCommandGuidance(
                    os_name="Arch Linux",
                    remediation_cmd="sudo ufw enable || sudo systemctl enable --now iptables",
                    verification_cmd="sudo ufw status || sudo iptables -S",
                    notes="Ensure ufw or iptables service is enabled via systemctl."
                ),
                schemas.RemediationCommandGuidance(
                    os_name="Fedora / RHEL",
                    remediation_cmd="sudo systemctl enable --now firewalld",
                    verification_cmd="sudo firewall-cmd --state",
                    notes="Verifies Firewalld daemon is running and enabled."
                ),
            ],
            automated_verification_note=(
                "The next FlientSec agent check-in will automatically verify the host firewall."
            )
        )

    elif "encryption" in norm_rule or "disk" in norm_rule:
        return schemas.RemediationGuidanceResponse(
            rule_id=rule_id,
            title="Full Disk Encryption (LUKS / dm-crypt)",
            why_it_matters=(
                "Disk encryption protects data at rest against physical extraction, stolen drives, "
                "and hardware theft. Unencrypted root filesystems leave credentials and data vulnerable."
            ),
            expected_state="Root filesystem (/) must be mounted on a LUKS or dm-crypt encrypted device node.",
            observed_state=observed_reason or "Root filesystem is mounted on an unencrypted volume.",
            os_guidance=[
                schemas.RemediationCommandGuidance(
                    os_name="Ubuntu / Debian",
                    remediation_cmd="# Disk encryption must be enabled during installation using LUKS/dm-crypt.",
                    verification_cmd="lsblk -r -o TYPE,MOUNTPOINT | grep -E 'crypt|/'",
                    notes="Check /etc/crypttab and lsblk output."
                ),
                schemas.RemediationCommandGuidance(
                    os_name="Arch Linux",
                    remediation_cmd="# Configure LUKS on the root partition via cryptsetup during install.",
                    verification_cmd="lsblk -o NAME,TYPE,MOUNTPOINT | grep crypt",
                    notes="Verify device mapper node in /proc/mounts."
                ),
                schemas.RemediationCommandGuidance(
                    os_name="Fedora / RHEL",
                    remediation_cmd="# Select Encrypt my data with LUKS during Anaconda OS installer.",
                    verification_cmd="lsblk -o NAME,TYPE,FSTYPE,MOUNTPOINT",
                    notes="Encrypted volumes appear with type 'crypt'."
                ),
            ],
            automated_verification_note="The next FlientSec agent check-in will verify the block device mount table."
        )

    elif "screen" in norm_rule or "lock" in norm_rule:
        return schemas.RemediationGuidanceResponse(
            rule_id=rule_id,
            title="Screen Lock & Inactivity Timeout",
            why_it_matters=(
                "Automatic screen lock prevents physical unauthorized access to unattended workstations, "
                "securing confidential sessions and open enterprise terminals."
            ),
            expected_state="Desktop session must enforce automatic screen lock within 300s of inactivity.",
            observed_state=observed_reason or "Screen lock is disabled or idle timeout exceeds policy baseline.",
            os_guidance=[
                schemas.RemediationCommandGuidance(
                    os_name="Ubuntu / Debian (GNOME)",
                    remediation_cmd=(
                        "gsettings set org.gnome.desktop.screensaver lock-enabled true && "
                        "gsettings set org.gnome.desktop.session idle-delay 300"
                    ),
                    verification_cmd=(
                        "gsettings get org.gnome.desktop.screensaver lock-enabled && "
                        "gsettings get org.gnome.desktop.session idle-delay"
                    ),
                    notes="Sets lock-enabled to true and 5-minute inactivity timer."
                ),
                schemas.RemediationCommandGuidance(
                    os_name="Arch Linux (GNOME / XFCE)",
                    remediation_cmd=(
                        "gsettings set org.gnome.desktop.screensaver lock-enabled true || "
                        "xfconf-query -c xfce4-session -p /general/LockCommand -s 'xflock4'"
                    ),
                    verification_cmd="gsettings get org.gnome.desktop.screensaver lock-enabled",
                    notes="Applies screen lock to current user desktop environment."
                ),
                schemas.RemediationCommandGuidance(
                    os_name="Fedora (GNOME)",
                    remediation_cmd=(
                        "gsettings set org.gnome.desktop.screensaver lock-enabled true && "
                        "gsettings set org.gnome.desktop.session idle-delay 300"
                    ),
                    verification_cmd="gsettings get org.gnome.desktop.screensaver lock-enabled",
                    notes="Configures GNOME desktop privacy settings."
                ),
            ],
            automated_verification_note=(
                "The next FlientSec agent check-in will inspect user session screensaver settings."
            )
        )

    elif "ssh" in norm_rule:
        return schemas.RemediationGuidanceResponse(
            rule_id=rule_id,
            title="Disable Inbound SSH Server",
            why_it_matters=(
                "Workstations should not run active SSH listening daemons unless explicitly required, "
                "as open port 22 expands the attack surface and allows remote brute-force attempts."
            ),
            expected_state="SSH server daemon (sshd / ssh) must be stopped and disabled.",
            observed_state=observed_reason or "SSH daemon is active or port 22 is open.",
            os_guidance=[
                schemas.RemediationCommandGuidance(
                    os_name="Ubuntu / Debian",
                    remediation_cmd="sudo systemctl stop ssh && sudo systemctl disable ssh",
                    verification_cmd="systemctl is-active ssh || echo 'inactive'",
                    notes="Disables the OpenSSH server service."
                ),
                schemas.RemediationCommandGuidance(
                    os_name="Arch Linux / Fedora",
                    remediation_cmd="sudo systemctl stop sshd && sudo systemctl disable sshd",
                    verification_cmd="systemctl is-active sshd || echo 'inactive'",
                    notes="Stops and disables the sshd systemd unit."
                ),
            ],
            automated_verification_note=(
                "The next FlientSec agent check-in will check daemon status and port 22 listener."
            )
        )

    elif "update" in norm_rule or "patch" in norm_rule:
        return schemas.RemediationGuidanceResponse(
            rule_id=rule_id,
            title="Apply System Security Updates",
            why_it_matters=(
                "Unpatched packages expose workstations to known CVEs and vulnerabilities. "
                "Keeping operating system components updated is essential for baseline hygiene."
            ),
            expected_state="No critical or pending security packages awaiting installation.",
            observed_state=observed_reason or "Pending package updates detected.",
            os_guidance=[
                schemas.RemediationCommandGuidance(
                    os_name="Ubuntu / Debian",
                    remediation_cmd="sudo apt-get update && sudo apt-get upgrade -y",
                    verification_cmd="apt-get -s upgrade",
                    notes="Upgrades all pending repository packages."
                ),
                schemas.RemediationCommandGuidance(
                    os_name="Arch Linux",
                    remediation_cmd="sudo pacman -Syu",
                    verification_cmd="checkupdates || echo 'Fully updated'",
                    notes="Synchronizes mirrors and updates system packages."
                ),
                schemas.RemediationCommandGuidance(
                    os_name="Fedora / RHEL",
                    remediation_cmd="sudo dnf upgrade -y",
                    verification_cmd="dnf check-update",
                    notes="Applies latest Fedora repository package updates."
                ),
            ],
            automated_verification_note=(
                "The next FlientSec agent check-in will verify the package manager update status."
            )
        )

    elif "runtime" in norm_rule or "node" in norm_rule or "python" in norm_rule or "docker" in norm_rule:
        return schemas.RemediationGuidanceResponse(
            rule_id=rule_id,
            title=f"Upgrade Developer Runtime ({check_name})",
            why_it_matters=(
                "Outdated developer runtimes and binaries may contain known vulnerabilities, "
                "lack security patches, or fail compliance baseline requirements."
            ),
            expected_state=f"Runtime {check_name} must satisfy the version constraint in the active policy.",
            observed_state=observed_reason or f"Installed {check_name} version does not satisfy policy baseline.",
            os_guidance=[
                schemas.RemediationCommandGuidance(
                    os_name="Ubuntu / Debian",
                    remediation_cmd=f"sudo apt-get update && sudo apt-get --only-upgrade install {check_name}",
                    verification_cmd=f"{check_name} --version || {check_name} version",
                    notes="Install or upgrade the runtime binary via apt."
                ),
                schemas.RemediationCommandGuidance(
                    os_name="Arch Linux",
                    remediation_cmd=f"sudo pacman -S --needed {check_name}",
                    verification_cmd=f"{check_name} --version",
                    notes="Install latest package version via pacman."
                ),
                schemas.RemediationCommandGuidance(
                    os_name="Fedora / RHEL",
                    remediation_cmd=f"sudo dnf upgrade -y {check_name}",
                    verification_cmd=f"{check_name} --version",
                    notes="Upgrade the package via dnf."
                ),
            ],
            automated_verification_note="The next FlientSec agent check-in will verify runtime binary version output."
        )

    else:
        # Generic fallback
        return schemas.RemediationGuidanceResponse(
            rule_id=rule_id,
            title=f"Remediate {check_name}",
            why_it_matters="Workstation configuration has drifted from the assigned enterprise security baseline.",
            expected_state=f"Workstation must satisfy policy rule '{rule_id}'.",
            observed_state=observed_reason or "Non-compliant state detected during agent check-in.",
            os_guidance=[
                schemas.RemediationCommandGuidance(
                    os_name="Linux",
                    remediation_cmd=f"# Consult internal enterprise policy for rule '{rule_id}'.",
                    verification_cmd="# Re-run workstation baseline check.",
                    notes="Review local workstation configuration."
                )
            ],
            automated_verification_note="The next FlientSec agent check-in will automatically evaluate the rule."
        )
