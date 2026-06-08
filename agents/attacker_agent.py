import time
import json
import os
import random
import paho.mqtt.client as mqtt

MQTT_BROKER = os.getenv("MQTT_BROKER_HOST", "mqtt-broker")
MQTT_PORT = int(os.getenv("MQTT_BROKER_PORT", 1883))
TELEMETRY_TOPIC = "medisentinel/iot/telemetry"
CONTROL_TOPIC = "medisentinel/iot/attack/toggle"
DEVICE_ID = "esp32-hr-sim-001"

# State variables to track whether attack simulation is active
attack_active = False
attack_type = "agent1_ddos"

def on_connect(client, userdata, flags, rc, properties=None):
    print(f"Attacker Agent connected to MQTT broker at {MQTT_BROKER}:{MQTT_PORT}")
    client.subscribe(CONTROL_TOPIC)
    print(f"Subscribed to control topic: {CONTROL_TOPIC}")

def on_message(client, userdata, msg):
    global attack_active, attack_type
    try:
        payload = json.loads(msg.payload.decode())
        if "attack_active" in payload:
            attack_active = payload["attack_active"]
        if "attack_type" in payload:
            attack_type = payload["attack_type"]
        print(f"[CONTROL] Attack simulation state updated: active={attack_active}, type={attack_type}")
    except Exception as e:
        print(f"Error handling control message: {e}")

def main():
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    client.on_connect = on_connect
    client.on_message = on_message
    
    print(f"Connecting to MQTT Broker at {MQTT_BROKER}:{MQTT_PORT}...")
    while True:
        try:
            client.connect(MQTT_BROKER, MQTT_PORT, 60)
            break
        except Exception as e:
            print(f"Waiting for MQTT broker to start... {e}")
            time.sleep(3)
            
    client.loop_start()
    
    print("Attacker Agent Loop Started. Standing by for control events...")
    
    try:
        while True:
            if attack_active:
                if attack_type == "agent1_ddos":
                    print("[ATTACK MODE] Publishing SYN Flood network parameters (DDoS)")
                    payload = {
                        "device_id": DEVICE_ID,
                        "heart_rate": round(random.uniform(72.0, 78.0), 1),
                        "spo2": round(random.uniform(97.0, 99.0), 1),
                        "timestamp": int(time.time() * 1000),
                        "battery_level": 98,
                        "attack_type": "agent1_ddos",
                        "network": {
                            "packet_rate": 2500,  # Exceeds threshold for SYN Flood
                            "bytes_sent": 150,
                            "bytes_received": 100,
                            "jitter": 45
                        }
                    }
                elif attack_type == "agent2_spoof":
                    hr = round(random.uniform(210.0, 230.0), 1)
                    spo2 = round(random.uniform(80.0, 84.0), 1)
                    print(f"[ATTACK MODE] Publishing anomalous telemetry (Poisoning): HR={hr} BPM, SpO2={spo2}%")
                    payload = {
                        "device_id": DEVICE_ID,
                        "heart_rate": hr,
                        "spo2": spo2,
                        "timestamp": int(time.time() * 1000),
                        "battery_level": 98,
                        "attack_type": "agent2_spoof",
                        "network": {
                            "packet_rate": 12,
                            "bytes_sent": 1200,
                            "bytes_received": 1000,
                            "jitter": 5
                        }
                    }
                elif attack_type == "agent3_c2":
                    print("[ATTACK MODE] Publishing C2 Beacon parameters")
                    payload = {
                        "device_id": DEVICE_ID,
                        "heart_rate": round(random.uniform(72.0, 78.0), 1),
                        "spo2": round(random.uniform(97.0, 99.0), 1),
                        "timestamp": int(time.time() * 1000),
                        "battery_level": 98,
                        "attack_type": "agent3_c2",
                        "network": {
                            "packet_rate": 18,
                            "bytes_sent": 16000,  # High asymmetry
                            "bytes_received": 1200,
                            "destination_ip": "45.33.32.156",  # Matches threat intelligence IOC feed
                            "jitter": 8
                        }
                    }
                elif attack_type == "agent4_vlan":
                    print("[ATTACK MODE] Publishing Port Scan parameters (Lateral Movement)")
                    payload = {
                        "device_id": DEVICE_ID,
                        "heart_rate": round(random.uniform(72.0, 78.0), 1),
                        "spo2": round(random.uniform(97.0, 99.0), 1),
                        "timestamp": int(time.time() * 1000),
                        "battery_level": 98,
                        "attack_type": "agent4_vlan",
                        "network": {
                            "packet_rate": 650,  # Matches port scan signature
                            "bytes_sent": 400,
                            "bytes_received": 300,
                            "jitter": 12
                        }
                    }
                elif attack_type == "agent5_tamper":
                    print("[ATTACK MODE] Publishing Ledger Tampering triggers")
                    payload = {
                        "device_id": DEVICE_ID,
                        "heart_rate": round(random.uniform(72.0, 78.0), 1),
                        "spo2": round(random.uniform(97.0, 99.0), 1),
                        "timestamp": int(time.time() * 1000),
                        "battery_level": 98,
                        "attack_type": "agent5_tamper",
                        "tamper_ledger": True,
                        "network": {
                            "packet_rate": 12,
                            "bytes_sent": 1200,
                            "bytes_received": 1000,
                            "jitter": 5
                        }
                    }
                else:
                    # Fallback to spoofing if unknown
                    hr = round(random.uniform(210.0, 230.0), 1)
                    spo2 = round(random.uniform(80.0, 84.0), 1)
                    payload = {
                        "device_id": DEVICE_ID,
                        "heart_rate": hr,
                        "spo2": spo2,
                        "timestamp": int(time.time() * 1000),
                        "battery_level": 98,
                        "network": {
                            "packet_rate": 12,
                            "bytes_sent": 1200,
                            "bytes_received": 1000,
                            "jitter": 5
                        }
                    }
            else:
                # Send normal telemetry
                hr = round(random.uniform(72.0, 80.0), 1)
                spo2 = round(random.uniform(97.0, 99.0), 1)
                print(f"[NORMAL MODE] Publishing normal telemetry: HR={hr} BPM, SpO2={spo2}%")
                payload = {
                    "device_id": DEVICE_ID,
                    "heart_rate": hr,
                    "spo2": spo2,
                    "timestamp": int(time.time() * 1000),
                    "battery_level": 98,
                    "network": {
                        "packet_rate": 12,
                        "bytes_sent": 1200,
                        "bytes_received": 1000,
                        "jitter": 5
                    }
                }
            
            client.publish(TELEMETRY_TOPIC, json.dumps(payload))
            time.sleep(3)
            
    except KeyboardInterrupt:
        print("Attacker Agent stopped by user.")
    finally:
        client.loop_stop()
        client.disconnect()

if __name__ == "__main__":
    main()
