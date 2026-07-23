odwbuqubudwu#!/bin/bash
set -e

echo "=== MediSentinel ESP32 Firmware Flashing Tool ==="

# 1. Update IP configuration
echo "[+] Running IP auto-configuration..."
./scripts/update_ip.py

# 2. Setup/Detect PlatformIO
ESP32_DIR="iot_devices/esp32_monitor"
VENV_DIR="$(pwd)/$ESP32_DIR/.venv_pio"

if command -v pio &> /dev/null; then
    echo "[+] Global platformio detected."
    PIO_CMD="pio"
elif [ -f "$VENV_DIR/bin/pio" ]; then
    echo "[+] Virtualenv platformio detected."
    PIO_CMD="$VENV_DIR/bin/pio"
else
    echo "[!] PlatformIO Core not found. Creating a local virtual environment..."
    python3 -m venv "$VENV_DIR"
    echo "[+] Installing PlatformIO inside virtual environment..."
    "$VENV_DIR/bin/pip" install --upgrade pip platformio
    PIO_CMD="$VENV_DIR/bin/pio"
fi

# Check version
$PIO_CMD --version

# 3. Detect serial ports
echo "[+] Detecting connected ESP32 devices..."
PORTS=()
for p in /dev/ttyUSB* /dev/ttyACM*; do
    if [ -e "$p" ]; then
        PORTS+=("$p")
    fi
done

SELECT_PORT=""
if [ ${#PORTS[@]} -eq 0 ]; then
    echo "[!] No USB serial devices (/dev/ttyUSB* or /dev/ttyACM*) detected."
    echo "[*] Will proceed with compilation and attempt auto-detection during upload."
elif [ ${#PORTS[@]} -eq 1 ]; then
    SELECT_PORT="${PORTS[0]}"
    echo "[+] Found single device at: $SELECT_PORT"
else
    echo "[?] Multiple devices found:"
    for i in "${!PORTS[@]}"; do
        echo "   [$i] ${PORTS[$i]}"
    done
    read -p "Select port index [0]: " idx
    idx=${idx:-0}
    SELECT_PORT="${PORTS[$idx]}"
    echo "[+] Selected port: $SELECT_PORT"
fi

# 4. Compile firmware
echo "[+] Compiling ESP32 firmware..."
(cd "$ESP32_DIR" && "$PIO_CMD" run)

# 5. Upload firmware
if [ -n "$SELECT_PORT" ]; then
    echo "[+] Flashing device at $SELECT_PORT..."
    (cd "$ESP32_DIR" && "$PIO_CMD" run -e v1_0_0 --target upload --upload-port "$SELECT_PORT")
else
    echo "[+] Flashing device (auto-detecting)..."
    (cd "$ESP32_DIR" && "$PIO_CMD" run -e v1_0_0 --target upload)
fi

echo "=== Flashing process completed successfully ==="
