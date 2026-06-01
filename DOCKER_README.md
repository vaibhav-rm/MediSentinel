# MediSentinel Docker Stack Runner Guide

This document describes how to deploy, manage, and verify the MediSentinel IoT Security Stack using the automated setup script.

## Quick Start Deployment

Simply execute the auto-runner script from the project root directory:

```bash
./run_stack.sh
```

### What the Script Does:
1. **Validates & Recovers Structure**: Checks for key components (`backend/Dockerfile`, `frontend/Dockerfile`, `agents/Dockerfile`, `docker-compose.yml`, `.env`). If any are missing, it dynamically generates them from pre-configured production-ready templates.
2. **Optimizes Dependencies**: Builds the services with **CPU-optimized PyTorch** indices, reducing the container image download size from over 1.2 GB to under 200 MB for faster build/startup.
3. **Launches Stack**: Runs `docker compose up --build -d` to compile and start all 8 network services simultaneously.

---

## Service Endpoints

Once running, access the services locally at:

*   **Frontend Security Dashboard**: [http://localhost:3000](http://localhost:3000)
*   **Backend FastAPI Server**: [http://localhost:8000](http://localhost:8000)
*   **FastAPI Swagger Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)
*   **Live WebSockets Feed**: `ws://localhost:8000/ws`
*   **MQTT Broker**: `localhost:1883`

---

## Simulating attacks & Autonomous Defense

To test the end-to-end security pipeline, run the **Attacker Agent**:

1. **Launch the Attacker Agent**:
   ```bash
   docker compose exec agents python attacker_agent.py
   ```
2. **How the Simulation Flows**:
   * **Phase 1 (Normal)**: Attacker sends normal heartbeat signals (75 BPM) to the telemetry topic.
   * **Phase 2 (Attack)**: Attacker injects a data-spoofing attack (220 BPM, 82% SpO2) targeting device `esp32-hr-sim-001`.
   * **Real-Time Defense**: 
     1. The `IoTGuardianAgent` identifies the anomaly.
     2. The `IncidentResponseAgent` quarantines the device in the Postgres database.
     3. The Backend publishes the quarantine control message back to the MQTT topic.
     4. The ESP32 device receives the message, and its local LCD screen instantly displays a bright red **"ATTACK! Status: QUARANTINED"** warning.
   * **Phase 3 (Cooldown & Verification)**: The attacker waits. You can reset the device status back to "active" in the frontend dashboard or Swagger docs to see the LCD return to green automatically.
