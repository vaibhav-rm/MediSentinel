# MediSentinel — Conference Paper Figures

Eight publication-ready figures for *“MediSentinel: Architecture Design of an AI-Driven
Autonomous Cybersecurity Framework for Healthcare Systems and Medical IoT.”*
All are 220 DPI PNGs on white backgrounds (print-safe). Regenerate any time with:

```bash
cd paper/figures && python3 generate_figures.py
```

Diagrams use Graphviz (`dot`); charts use matplotlib with the **exact numbers** from the
paper's Tables II & III (detection performance / adversarial robustness) and the Results section.

> **Note:** All eight figures are now embedded in `medisentinel_conference(1).docx`. In the paper
> they are numbered in **order of appearance** (IEEE convention), which differs from the file-name
> suffixes below. The mapping is: Fig. 1 = `fig1`, Fig. 2 = `fig3`, Fig. 3 = `fig6`, Fig. 4 = `fig7`,
> Fig. 5 = `fig4`, Fig. 6 = `fig2`, Fig. 7 = `fig5`, Fig. 8 = `fig8`. Each figure is referenced inline
> in the text and carries a self-contained caption.

| File | Place in section | Suggested caption (Fig. N) |
|------|------------------|-----------------------------|
| `fig1_system_architecture.png` | Methodology → *System Architecture* | **Fig. 1.** MediSentinel system architecture: medical IoT endpoints publish telemetry over MQTT to a FastAPI bridge that streams to an Apache Kafka bus; five specialized AI agents consume events, and the Incident Response agent drives autonomous containment back to the device. PostgreSQL stores the hash-chained audit log. |
| `fig2_response_flow.png` | Methodology / Results → *Response Latency* | **Fig. 2.** Autonomous detection-to-containment pipeline. Spoofed telemetry is detected by the model agents (MTTD ≈ 3.8 s), contained by the Incident Response agent (MTTR ≈ 8.2 s), recorded in the audit ledger, and the device is restored once the threat clears. |
| `fig3_detection_models.png` | Methodology → *Network Monitor / IoT Guardian Agent* | **Fig. 3.** Detection model pipelines. The Network Monitor combines an LSTM temporal model and an Isolation Forest with a logical-AND decision to suppress false positives; the IoT Guardian flags reconstruction error above the 99.5th percentile of a per-device-class autoencoder. |
| `fig4_detection_performance.png` | Results → *Detection Performance* (with Table II) | **Fig. 4.** Detection accuracy, F1, and false-positive rate per agent and dataset. All agents meet or approach the 95% accuracy target with FPR < 2.5%. |
| `fig5_adversarial_robustness.png` | Results → *Adversarial Robustness* (with Table III) | **Fig. 5.** Network Monitor accuracy under FGSM, PGD, and Carlini–Wagner attacks before and after IBM ART adversarial hardening. Hardening recovers accuracy from as low as 38% to 79–90%. |
| `fig6_audit_hashchain.png` | Methodology → *Compliance and Audit Agent* | **Fig. 6.** Cryptographically hash-chained audit ledger. Each block binds the previous hash, satisfying HIPAA 45 CFR 164.312(b); any tampering breaks the chain. |
| `fig7_federated_learning.png` | Methodology → *Federated Learning for Multi-Hospital Deployment* | **Fig. 7.** Federated learning across hospitals. Sites share only model weight updates (FedAvg); raw patient data never leaves the institution, preserving data sovereignty. |
| `fig8_response_latency.png` | Results → *Response Latency* / Conclusion | **Fig. 8.** Response latency versus industry averages (log scale): MTTD/MTTR fall from 197/69 days to 3.8/8.2 s — a ≈99.9% reduction. |

## Notes
- The architecture (Fig. 1/2/6) mirrors the **actual implementation** (ESP32 + MAX30100 over
  MQTT, FastAPI↔Kafka bridge, five agents, PostgreSQL SHA-256 hash chain, React dashboard,
  signed OTA), so the figures are faithful, not aspirational.
- Recommended order for an IEEE two-column paper: Fig. 1 early in Methodology; Figs. 3, 6, 7
  alongside their agent/feature subsections; Figs. 2, 4, 5, 8 in Results.
- To embed in the `.docx`, Insert → Pictures and add the caption with Word's *Insert Caption*
  so numbering/cross-references stay automatic.
```
