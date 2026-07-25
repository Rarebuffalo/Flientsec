# Product Specification: Device Lifecycle State Machine

This specification defines the compliance states, transition triggers, and decommissioning parameters for developer workstations.

---

## 1. Lifecycle States Definitions

- **`Pending`:** The device enrollment record has been initialized, but the agent has not completed its first check-in.
- **`Online`:** Heartbeat packets have been received successfully within the last 5 minutes.
- **`Offline`:** Pings have been missed for over 5 minutes. Represents an inactive workstation with no new compliance failures.
- **`Warning`:** The last check-in completed, but detected low/medium severity compliance violations (Score is between 60 and 99).
- **`Failing`:** The last check-in completed, but detected high severity violations (Score is below 60).
- **`Decommissioned`:** The device has been retired. The agent's token is revoked, and telemetry data is hidden or deleted.

---

## 2. State Machine Transitions Diagram

```
         Onboarded                       Compliance OK
    ┌────────────────────────────────────────────────────────┐
    │                                                        ▼
┌───┴───┐  Heartbeat Lost  ┌───┴───┐  Check Fail  ┌──────────┴──────────┐
│Pending│─────────────────>│Online │─────────────>│  Warning / Failing  │
└───┬───┘      (>5min)     └───┬───┘              └──────────┬──────────┘
    │                          │                             │
    │ Decommission             │ Decommission                │ Decommission
    └──────────────────────────┼─────────────────────────────┘
                               ▼
                        ┌──────────────┐
                        │Decommissioned│
                        └──────────────┘
```

---

## 3. Edge Cases & Handling Strategy

### Reinstalling Operating System
- **Scenario:** A user formatted their drive and re-installed Linux, resetting the agent configuration.
- **Handling:** Running the setup installer again with the enrollment token checks if the hardware serial number already exists. If yes, it re-registers the original device record and updates the `device_token` rather than creating a duplicate record.

### Decommissioning / Revocation
- **Scenario:** A developer leaves the company or a laptop is reported stolen.
- **Handling:** Admin triggers "Revoke Device" on the Settings panel. The backend sets the device status to `Decommissioned` and rejects any further telemetry check-ins from that UUID, returning `HTTP 403 Forbidden`.
