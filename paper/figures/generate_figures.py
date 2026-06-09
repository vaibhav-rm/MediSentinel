#!/usr/bin/env python3
"""
Generate publication-quality figures for the MediSentinel conference paper.

Diagrams (system architecture, data flow, detection models, hash chain, federated
learning) are rendered with Graphviz `dot`; quantitative charts (detection
performance, adversarial robustness, response latency) with matplotlib using the
exact numbers from the paper's Tables I & II and Results section.

Run:  python3 generate_figures.py     (writes *.png into this directory)
"""
import os
import subprocess
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))

# ── Shared palette (IEEE-friendly, print on white) ──────────────────────────
NAVY   = "#1F4E79"
BLUE   = "#2E75B6"
LBLUE  = "#D9E2F3"
LBLUE2 = "#EAF1FB"
GREEN  = "#2E9E6B"
LGREEN = "#DBF0E4"
RED    = "#D4495B"
LRED   = "#FBE3E6"
AMBER  = "#D89A30"
LAMBER = "#FBEFD6"
PURPLE = "#7E5BC2"
LPURP  = "#ECE4F7"
GREY   = "#5A5A5A"
LGREY  = "#EFEFF2"
FONT   = "Helvetica"


def render_dot(name: str, dot: str, dpi: int = 220):
    src = os.path.join(HERE, f"{name}.dot")
    out = os.path.join(HERE, f"{name}.png")
    with open(src, "w") as f:
        f.write(dot)
    subprocess.run(["dot", "-Tpng", f"-Gdpi={dpi}", src, "-o", out], check=True)
    os.remove(src)
    print(f"  ✓ {name}.png")


# ════════════════════════════════════════════════════════════════════════════
# FIG 1 — System architecture
# ════════════════════════════════════════════════════════════════════════════
def fig1_architecture():
    dot = f'''
digraph G {{
  bgcolor="white"; rankdir=TB; splines=spline; nodesep=0.35; ranksep=0.6;
  fontname="{FONT}";
  node [fontname="{FONT}", fontsize=11, shape=box, style="rounded,filled", color="{NAVY}", penwidth=1.2, margin="0.16,0.09"];
  edge [fontname="{FONT}", fontsize=9, color="{GREY}", penwidth=1.1, arrowsize=0.7];

  subgraph cluster_dev {{
    label="Medical IoT Layer"; fontsize=12; fontcolor="{NAVY}"; color="{BLUE}"; style="rounded"; bgcolor="{LBLUE2}";
    esp32 [label="ESP32 Edge Node\\n(MAX30100 PPG + ST7735 TFT)", fillcolor="{LBLUE}"];
    pump  [label="Infusion Pump", fillcolor="white"];
    vent  [label="Ventilator", fillcolor="white"];
    ecg   [label="ECG / Cardiac Monitor", fillcolor="white"];
  }}

  mqtt [label="Eclipse Mosquitto\\nMQTT Broker", fillcolor="{LGREEN}", color="{GREEN}"];

  backend [label="FastAPI Backend Bridge\\nMQTT ↔ Kafka  •  REST + WebSocket\\nSigned OTA  •  Device Registry", fillcolor="{LBLUE}", width=3.4];

  subgraph cluster_data {{
    label="Persistence"; fontsize=12; fontcolor="{NAVY}"; color="{GREY}"; style="rounded"; bgcolor="{LGREY}";
    pg  [label="PostgreSQL\\nHash-chained Audit Log\\nDevices • Alerts", fillcolor="white"];
    redis [label="Redis\\nState Cache", fillcolor="white"];
  }}

  kafka [label="Apache Kafka Event Bus\\ntopics:  raw_data  |  alerts  |  threat_intel", fillcolor="{LAMBER}", color="{AMBER}", width=4.2];

  subgraph cluster_agents {{
    label="Autonomous Multi-Agent AI Cluster"; fontsize=12; fontcolor="{NAVY}"; color="{PURPLE}"; style="rounded"; bgcolor="{LPURP}";
    a1 [label="① Network Monitor\\nLSTM + Isolation Forest", fillcolor="white"];
    a2 [label="② IoT Guardian\\nAutoencoder + Rule Engine", fillcolor="white"];
    a3 [label="③ Threat Intelligence\\nSTIX / TAXII Feeds", fillcolor="white"];
    a4 [label="④ Incident Response\\nDecision Tree + Policy", fillcolor="{LRED}", color="{RED}"];
    a5 [label="⑤ Compliance Audit\\nSHA-256 Hash Chain", fillcolor="white"];
  }}

  dash [label="React Analyst Dashboard\\n(live WebSocket telemetry)", fillcolor="{LBLUE}"];

  // Telemetry upstream
  esp32 -> mqtt [label="MQTT telemetry"];
  pump  -> mqtt; vent -> mqtt; ecg -> mqtt;
  mqtt -> backend [label="subscribe"];
  backend -> kafka [label="produce raw_data"];
  kafka -> a1 [label="consume"]; kafka -> a2; kafka -> a3;

  // Detection / alerting
  a1 -> kafka [label="alerts", color="{RED}", fontcolor="{RED}"];
  a2 -> kafka [color="{RED}"];
  a3 -> a4 [style=dashed, label="IOC match"];
  kafka -> a4 [label="alerts"];
  a4 -> a5 [style=dashed];

  // Autonomous containment back to the device
  a4 -> backend [label="quarantine / OTA", color="{RED}", fontcolor="{RED}", penwidth=1.6];
  backend -> mqtt [label="MQTT control", color="{RED}", fontcolor="{RED}", penwidth=1.6];
  mqtt -> esp32 [label="isolate / update", color="{RED}", penwidth=1.6];

  // Side services
  backend -> pg ; backend -> redis ; a5 -> pg [label="append block", style=dashed];
  backend -> dash [label="WebSocket"];
  kafka -> backend [label="consume alerts", style=dashed];
}}
'''
    render_dot("fig1_system_architecture", dot)


# ════════════════════════════════════════════════════════════════════════════
# FIG 2 — Autonomous detect → contain → recover flow (with latency budget)
# ════════════════════════════════════════════════════════════════════════════
def fig2_response_flow():
    dot = f'''
digraph G {{
  bgcolor="white"; rankdir=LR; nodesep=0.3; ranksep=0.55; fontname="{FONT}";
  node [fontname="{FONT}", fontsize=11, shape=box, style="rounded,filled", penwidth=1.2, margin="0.16,0.1"];
  edge [fontname="{FONT}", fontsize=9, color="{GREY}", arrowsize=0.7];

  attack [label="Attack /\\nSpoofed Telemetry", shape=note, fillcolor="{LRED}", color="{RED}"];
  dev    [label="IoT Device\\n(ESP32)", fillcolor="{LBLUE}", color="{NAVY}"];
  bus    [label="MQTT → Kafka\\nraw_data", fillcolor="{LAMBER}", color="{AMBER}"];

  subgraph cluster_detect {{
    label="Detection  (MTTD ≈ 3.8 s)"; fontsize=11; fontcolor="{NAVY}"; color="{BLUE}"; style="rounded"; bgcolor="{LBLUE2}";
    nm [label="Network Monitor\\nLSTM ∧ Iso-Forest", fillcolor="white"];
    ig [label="IoT Guardian\\nAutoencoder + Rules", fillcolor="white"];
    ti [label="Threat Intel\\nIOC correlation", fillcolor="white"];
  }}

  ir   [label="Incident Response\\nautonomous containment", fillcolor="{LRED}", color="{RED}"];
  quar [label="Device Quarantined\\n(LCD: QUARANTINED)", fillcolor="{LRED}", color="{RED}"];
  ca   [label="Compliance Audit\\nhash-chained log", fillcolor="{LGREEN}", color="{GREEN}"];
  rec  [label="Threat cleared →\\nDevice restored (SECURE)", fillcolor="{LGREEN}", color="{GREEN}"];

  attack -> dev [color="{RED}"];
  dev -> bus -> nm; bus -> ig; bus -> ti;
  nm -> ir [label="anomaly", color="{RED}", fontcolor="{RED}"];
  ig -> ir [color="{RED}"]; ti -> ir [style=dashed];
  ir -> quar [label="contain  (MTTR ≈ 8.2 s)", color="{RED}", fontcolor="{RED}", penwidth=1.6];
  ir -> ca [style=dashed, label="record"];
  quar -> rec [label="debounced\\nrecovery", color="{GREEN}", fontcolor="{GREEN}"];
}}
'''
    render_dot("fig2_response_flow", dot)


# ════════════════════════════════════════════════════════════════════════════
# FIG 3 — Per-agent detection model pipelines
# ════════════════════════════════════════════════════════════════════════════
def fig3_detection_models():
    dot = f'''
digraph G {{
  bgcolor="white"; rankdir=LR; fontname="{FONT}"; ranksep=0.5; nodesep=0.3;
  node [fontname="{FONT}", fontsize=10, shape=box, style="rounded,filled", penwidth=1.1, margin="0.14,0.08"];
  edge [fontname="{FONT}", fontsize=9, color="{GREY}", arrowsize=0.65];

  subgraph cluster_nm {{
    label="Network Monitor Agent  —  dual-model ensemble"; fontsize=11; fontcolor="{NAVY}"; color="{BLUE}"; style="rounded"; bgcolor="{LBLUE2}";
    feat [label="Per-flow features\\n(60 s window)", fillcolor="white"];
    lstm [label="LSTM\\ntemporal model", fillcolor="{LBLUE}"];
    iso  [label="Isolation Forest\\noutlier score", fillcolor="{LBLUE}"];
    andg [label="AND", shape=circle, fillcolor="{LAMBER}", color="{AMBER}", width=0.5, fixedsize=true];
    alert1 [label="Alert\\n(low FPR)", fillcolor="{LRED}", color="{RED}"];
    feat -> lstm; feat -> iso;
    lstm -> andg [label="> τ_net"]; iso -> andg [label="anomaly"];
    andg -> alert1;
  }}

  subgraph cluster_ig {{
    label="IoT Guardian Agent  —  behavioral autoencoder"; fontsize=11; fontcolor="{NAVY}"; color="{GREEN}"; style="rounded"; bgcolor="{LGREEN}";
    tel [label="Device telemetry\\nCPU•mem•rate•sensor", fillcolor="white"];
    enc [label="Encoder", fillcolor="white"];
    z   [label="z", shape=circle, fillcolor="{LGREEN}", width=0.4, fixedsize=true];
    dec [label="Decoder", fillcolor="white"];
    err [label="Reconstruction error\\n> 99.5th pct ?", fillcolor="{LAMBER}", color="{AMBER}"];
    alert2 [label="Anomaly\\n(no firmware mod)", fillcolor="{LRED}", color="{RED}"];
    tel -> enc -> z -> dec -> err -> alert2;
  }}
}}
'''
    render_dot("fig3_detection_models", dot)


# ════════════════════════════════════════════════════════════════════════════
# FIG 6 — Hash-chained audit ledger
# ════════════════════════════════════════════════════════════════════════════
def fig6_hashchain():
    dot = f'''
digraph G {{
  bgcolor="white"; rankdir=LR; fontname="{FONT}"; nodesep=0.5; ranksep=0.7;
  node [fontname="{FONT}", fontsize=10, shape=record, style="filled", fillcolor="{LBLUE}", color="{NAVY}", penwidth=1.2];
  edge [fontname="{FONT}", fontsize=9, color="{NAVY}", arrowsize=0.8, penwidth=1.3];

  gen [label="{{Genesis|h₀}}", fillcolor="{LGREY}", color="{GREY}"];
  b1  [label="{{Block i-1|event tᵢ₋₁|prev: h₀|hᵢ₋₁}}"];
  b2  [label="{{Block i|event tᵢ|prev: hᵢ₋₁|hᵢ}}"];
  b3  [label="{{Block i+1|event tᵢ₊₁|prev: hᵢ|hᵢ₊₁}}"];

  gen -> b1 -> b2 -> b3;

  note [shape=note, fillcolor="{LAMBER}", color="{AMBER}", fontsize=10,
        label="hᵢ = SHA-256( hᵢ₋₁ ∥ tᵢ ∥ payload )\\nHIPAA 45 CFR 164.312(b) · any edit breaks the chain"];
  {{ rank=sink; note; }}
  b2 -> note [style=dashed, arrowhead=none, color="{AMBER}"];
}}
'''
    render_dot("fig6_audit_hashchain", dot)


# ════════════════════════════════════════════════════════════════════════════
# FIG 7 — Federated learning across hospitals
# ════════════════════════════════════════════════════════════════════════════
def fig7_federated():
    dot = f'''
digraph G {{
  bgcolor="white"; rankdir=TB; fontname="{FONT}"; nodesep=0.5; ranksep=0.7;
  node [fontname="{FONT}", fontsize=10, shape=box, style="rounded,filled", penwidth=1.2, margin="0.16,0.09"];
  edge [fontname="{FONT}", fontsize=9, color="{GREY}", arrowsize=0.7];

  server [label="Federated Server\\nweighted FedAvg of model weights", fillcolor="{LAMBER}", color="{AMBER}", width=3.6];

  subgraph cluster_h {{
    label="Participating Hospitals (data never leaves site)"; fontsize=11; fontcolor="{NAVY}"; color="{BLUE}"; style="rounded"; bgcolor="{LBLUE2}";
    hA [label="Hospital A\\nlocal MediSentinel\\n+ local model", fillcolor="white"];
    hB [label="Hospital B\\nlocal MediSentinel\\n+ local model", fillcolor="white"];
    hC [label="Hospital C\\nlocal MediSentinel\\n+ local model", fillcolor="white"];
  }}

  hA -> server [label="Δ weights", color="{GREEN}", fontcolor="{GREEN}"];
  hB -> server [color="{GREEN}"];
  hC -> server [color="{GREEN}"];
  server -> hA [label="global weights", color="{BLUE}", fontcolor="{BLUE}", constraint=false];
  server -> hB [color="{BLUE}", constraint=false];
  server -> hC [color="{BLUE}", constraint=false];
}}
'''
    render_dot("fig7_federated_learning", dot)


# ════════════════════════════════════════════════════════════════════════════
# matplotlib styling
# ════════════════════════════════════════════════════════════════════════════
def _style(ax):
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color("#999")
    ax.spines["bottom"].set_color("#999")
    ax.tick_params(colors="#333")
    ax.yaxis.grid(True, color="#E2E2E8", linewidth=0.8)
    ax.set_axisbelow(True)

plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 11})


# FIG 4 — Detection performance (Table I)
def fig4_detection_performance():
    labels = ["Net.Mon /\nCICIDS-2018", "Net.Mon /\nNSL-KDD", "IoT Grd /\nIoTID20",
              "Net.Mon /\nSynthetic HC", "IoT Grd /\nSynthetic HC"]
    acc = [97.3, 96.8, 95.6, 94.1, 93.8]
    f1  = [97.1, 96.5, 95.3, 93.8, 93.4]
    fpr = [1.4, 1.7, 1.9, 2.1, 2.3]

    fig, ax1 = plt.subplots(figsize=(9, 4.6))
    x = np.arange(len(labels)); w = 0.38
    ax1.bar(x - w/2, acc, w, label="Accuracy (%)", color=BLUE, edgecolor="white")
    ax1.bar(x + w/2, f1,  w, label="F1 ×100",       color=GREEN, edgecolor="white")
    ax1.axhline(95, color=GREY, ls="--", lw=1, label="95% target")
    for i, v in enumerate(acc): ax1.text(x[i]-w/2, v+0.3, f"{v}", ha="center", fontsize=8.5, color=NAVY)
    _style(ax1)
    ax1.set_ylim(88, 100); ax1.set_ylabel("Accuracy / F1")
    ax1.set_xticks(x); ax1.set_xticklabels(labels, fontsize=9)

    ax2 = ax1.twinx()
    ax2.plot(x, fpr, "o-", color=RED, lw=1.8, label="FPR (%)")
    for i, v in enumerate(fpr): ax2.text(x[i], v+0.06, f"{v}", ha="center", fontsize=8.5, color=RED)
    ax2.set_ylim(0, 4); ax2.set_ylabel("False Positive Rate (%)", color=RED)
    ax2.tick_params(axis="y", colors=RED); ax2.spines["top"].set_visible(False)

    h1, l1 = ax1.get_legend_handles_labels(); h2, l2 = ax2.get_legend_handles_labels()
    ax1.legend(h1 + h2, l1 + l2, loc="lower left", fontsize=9, framealpha=0.95, ncol=2)
    ax1.set_title("Detection Performance by Agent and Dataset", color=NAVY, fontweight="bold", pad=10)
    fig.tight_layout(); fig.savefig(os.path.join(HERE, "fig4_detection_performance.png"), dpi=220)
    plt.close(fig); print("  ✓ fig4_detection_performance.png")


# FIG 5 — Adversarial robustness (Table II)
def fig5_adversarial():
    attacks = ["No Attack", "FGSM\n(ε=0.1)", "PGD\n(20 steps)", "Carlini-Wagner\n(L2)"]
    baseline = [97.3, 61.4, 44.8, 38.2]
    hardened = [97.1, 89.7, 84.3, 79.6]
    fig, ax = plt.subplots(figsize=(8.4, 4.6))
    x = np.arange(len(attacks)); w = 0.38
    b1 = ax.bar(x - w/2, baseline, w, label="Baseline", color="#B9C4D6", edgecolor="white")
    b2 = ax.bar(x + w/2, hardened, w, label="ART-Hardened", color=BLUE, edgecolor="white")
    for bars in (b1, b2):
        for b in bars:
            ax.text(b.get_x()+b.get_width()/2, b.get_height()+1, f"{b.get_height():.1f}",
                    ha="center", fontsize=9, color=NAVY)
    _style(ax)
    ax.set_ylim(0, 108); ax.set_ylabel("Detection Accuracy (%)")
    ax.set_xticks(x); ax.set_xticklabels(attacks)
    ax.legend(fontsize=10, framealpha=0.95)
    ax.set_title("Adversarial Robustness — Network Monitor Agent", color=NAVY, fontweight="bold", pad=10)
    fig.tight_layout(); fig.savefig(os.path.join(HERE, "fig5_adversarial_robustness.png"), dpi=220)
    plt.close(fig); print("  ✓ fig5_adversarial_robustness.png")


# FIG 8 — Response latency vs industry (log scale)
def fig8_latency():
    labels = ["MTTD\n(industry [1])", "MTTR\n(industry [1])", "MTTD\nMediSentinel", "MTTR\nMediSentinel"]
    seconds = [197*86400, 69*86400, 3.8, 8.2]
    colors = ["#B9C4D6", "#B9C4D6", BLUE, GREEN]
    fig, ax = plt.subplots(figsize=(8.2, 4.4))
    bars = ax.bar(labels, seconds, color=colors, edgecolor="white", width=0.6)
    ax.set_yscale("log")
    ax.set_ylabel("Time to detect / respond (seconds, log scale)")
    txt = ["197 days", "69 days", "3.8 s", "8.2 s"]
    for b, t in zip(bars, txt):
        ax.text(b.get_x()+b.get_width()/2, b.get_height()*1.3, t, ha="center", fontsize=10, color=NAVY, fontweight="bold")
    _style(ax); ax.yaxis.grid(True, which="both", color="#E2E2E8", linewidth=0.7)
    ax.set_title("Response Latency: MediSentinel vs. Industry Average (~99.9% reduction)",
                 color=NAVY, fontweight="bold", fontsize=11, pad=10)
    fig.tight_layout(); fig.savefig(os.path.join(HERE, "fig8_response_latency.png"), dpi=220)
    plt.close(fig); print("  ✓ fig8_response_latency.png")


if __name__ == "__main__":
    print("Generating MediSentinel paper figures…")
    fig1_architecture()
    fig2_response_flow()
    fig3_detection_models()
    fig6_hashchain()
    fig7_federated()
    fig4_detection_performance()
    fig5_adversarial()
    fig8_latency()
    print("Done.")
