#!/bin/bash
set -e

echo "=== MediSentinel Docker Stack Auto-Setup & Runner ==="

# Create directories if missing
mkdir -p backend frontend agents

# 1. Check and create backend/Dockerfile if not present
if [ ! -f backend/Dockerfile ]; then
    echo "[+] Creating backend/Dockerfile..."
    printf '%s\n' \
        'FROM python:3.11-slim' \
        'WORKDIR /app' \
        'RUN apt-get update && apt-get install -y --no-install-recommends gcc && rm -rf /var/lib/apt/lists/*' \
        'COPY requirements.txt .' \
        'RUN pip install --no-cache-dir -r requirements.txt --extra-index-url https://download.pytorch.org/whl/cpu' \
        'COPY . .' \
        'EXPOSE 8000' \
        'CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]' \
        > backend/Dockerfile
fi

# 2. Check and create agents/Dockerfile if not present
if [ ! -f agents/Dockerfile ]; then
    echo "[+] Creating agents/Dockerfile..."
    printf '%s\n' \
        'FROM python:3.11-slim' \
        'WORKDIR /app' \
        'RUN apt-get update && apt-get install -y --no-install-recommends gcc && rm -rf /var/lib/apt/lists/*' \
        'COPY requirements.txt .' \
        'RUN pip install --no-cache-dir -r requirements.txt --extra-index-url https://download.pytorch.org/whl/cpu' \
        'COPY . .' \
        'CMD ["python", "main.py"]' \
        > agents/Dockerfile
fi

# 3. Check and create frontend/Dockerfile if not present
if [ ! -f frontend/Dockerfile ]; then
    echo "[+] Creating frontend/Dockerfile..."
    printf '%s\n' \
        'FROM node:20-alpine as build' \
        'WORKDIR /app' \
        'COPY package*.json ./' \
        'RUN npm install' \
        'COPY . .' \
        'RUN npm run build' \
        'FROM nginx:alpine' \
        'COPY --from=build /app/dist /usr/share/nginx/html' \
        'EXPOSE 80' \
        'CMD ["nginx", "-g", "daemon off;"]' \
        > frontend/Dockerfile
fi

# 4. Check and create docker-compose.yml if not present
if [ ! -f docker-compose.yml ]; then
    echo "[+] Creating docker-compose.yml..."
    printf '%s\n' \
        'services:' \
        '  zookeeper:' \
        '    image: confluentinc/cp-zookeeper:7.5.0' \
        '    container_name: medisentinel-zookeeper' \
        '    environment:' \
        '      ZOOKEEPER_CLIENT_PORT: 2181' \
        '      ZOOKEEPER_TICK_TIME: 2000' \
        '    ports:' \
        '      - "2181:2181"' \
        '    networks:' \
        '      - medisentinel-net' \
        '    healthcheck:' \
        '      test: ["CMD", "nc", "-z", "localhost", "2181"]' \
        '      interval: 10s' \
        '      timeout: 5s' \
        '      retries: 5' \
        '  kafka:' \
        '    image: confluentinc/cp-kafka:7.5.0' \
        '    container_name: medisentinel-kafka' \
        '    depends_on:' \
        '      zookeeper:' \
        '        condition: service_healthy' \
        '    ports:' \
        '      - "9092:9092"' \
        '    environment:' \
        '      KAFKA_BROKER_ID: 1' \
        '      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181' \
        '      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:29092,PLAINTEXT_HOST://localhost:9092' \
        '      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT' \
        '      KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT' \
        '      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1' \
        '      KAFKA_AUTO_CREATE_TOPICS_ENABLE: "true"' \
        '    networks:' \
        '      - medisentinel-net' \
        '    healthcheck:' \
        '      test: ["CMD", "kafka-topics", "--bootstrap-server", "localhost:9092", "--list"]' \
        '      interval: 15s' \
        '      timeout: 10s' \
        '      retries: 10' \
        '  mqtt-broker:' \
        '    image: eclipse-mosquitto:2.0' \
        '    container_name: medisentinel-mqtt' \
        '    ports:' \
        '      - "1883:1883"' \
        '      - "9001:9001"' \
        '    volumes:' \
        '      - ./infrastructure/mosquitto/mosquitto.conf:/mosquitto/config/mosquitto.conf' \
        '      - mosquitto-data:/mosquitto/data' \
        '      - mosquitto-logs:/mosquitto/log' \
        '    networks:' \
        '      - medisentinel-net' \
        '    healthcheck:' \
        '      test: ["CMD", "mosquitto_pub", "-h", "localhost", "-t", "test", "-m", "ping"]' \
        '      interval: 10s' \
        '      timeout: 5s' \
        '      retries: 5' \
        '  postgres:' \
        '    image: postgres:15-alpine' \
        '    container_name: medisentinel-postgres' \
        '    environment:' \
        '      POSTGRES_USER: medi_user' \
        '      POSTGRES_PASSWORD: medi_password' \
        '      POSTGRES_DB: medisentinel' \
        '    ports:' \
        '      - "5432:5432"' \
        '    volumes:' \
        '      - postgres-data:/var/lib/postgresql/data' \
        '    networks:' \
        '      - medisentinel-net' \
        '    healthcheck:' \
        '      test: ["CMD-SHELL", "pg_isready -U medi_user -d medisentinel"]' \
        '      interval: 10s' \
        '      timeout: 5s' \
        '      retries: 5' \
        '  redis:' \
        '    image: redis:7-alpine' \
        '    container_name: medisentinel-redis' \
        '    ports:' \
        '      - "6379:6379"' \
        '    volumes:' \
        '      - redis-data:/data' \
        '    networks:' \
        '      - medisentinel-net' \
        '    healthcheck:' \
        '      test: ["CMD", "redis-cli", "ping"]' \
        '      interval: 10s' \
        '      timeout: 5s' \
        '      retries: 5' \
        '  backend:' \
        '    build:' \
        '      context: ./backend' \
        '      dockerfile: Dockerfile' \
        '    container_name: medisentinel-backend' \
        '    depends_on:' \
        '      kafka:' \
        '        condition: service_healthy' \
        '      mqtt-broker:' \
        '        condition: service_healthy' \
        '      postgres:' \
        '        condition: service_healthy' \
        '      redis:' \
        '        condition: service_healthy' \
        '    ports:' \
        '      - "8000:8000"' \
        '    environment:' \
        '      - KAFKA_BOOTSTRAP_SERVERS=kafka:29092' \
        '      - MQTT_BROKER_HOST=mqtt-broker' \
        '      - MQTT_BROKER_PORT=1883' \
        '      - SECRET_KEY=${SECRET_KEY:-medisentinel_super_secret_key_change_in_prod}' \
        '      - DATABASE_URL=postgresql+asyncpg://medi_user:medi_password@postgres:5432/medisentinel' \
        '      - REDIS_URL=redis://redis:6379/0' \
        '    volumes:' \
        '      - ./backend:/app' \
        '    networks:' \
        '      - medisentinel-net' \
        '    restart: unless-stopped' \
        '  agents:' \
        '    build:' \
        '      context: ./agents' \
        '      dockerfile: Dockerfile' \
        '    container_name: medisentinel-agents' \
        '    depends_on:' \
        '      kafka:' \
        '        condition: service_healthy' \
        '      backend:' \
        '        condition: service_started' \
        '      postgres:' \
        '        condition: service_healthy' \
        '    environment:' \
        '      - KAFKA_BOOTSTRAP_SERVERS=kafka:29092' \
        '      - BACKEND_URL=http://backend:8000' \
        '      - DATABASE_URL=postgresql+asyncpg://medi_user:medi_password@postgres:5432/medisentinel' \
        '      - SECRET_KEY=$${SECRET_KEY:-medisentinel_super_secret_key_change_in_prod}' \
        '    volumes:' \
        '      - ./agents:/app' \
        '    networks:' \
        '      - medisentinel-net' \
        '    restart: unless-stopped' \
        '  attacker-agent:' \
        '    build:' \
        '      context: ./agents' \
        '      dockerfile: Dockerfile' \
        '    container_name: medisentinel-attacker-agent' \
        '    depends_on:' \
        '      backend:' \
        '        condition: service_started' \
        '      mqtt-broker:' \
        '        condition: service_healthy' \
        '    command: ["python", "attacker_agent.py"]' \
        '    environment:' \
        '      - MQTT_BROKER_HOST=mqtt-broker' \
        '      - MQTT_BROKER_PORT=1883' \
        '    networks:' \
        '      - medisentinel-net' \
        '    restart: unless-stopped' \
        '  frontend:' \
        '    build:' \
        '      context: ./frontend' \
        '      dockerfile: Dockerfile' \
        '    container_name: medisentinel-frontend' \
        '    depends_on:' \
        '      - backend' \
        '    ports:' \
        '      - "3000:80"' \
        '    networks:' \
        '      - medisentinel-net' \
        '    restart: unless-stopped' \
        'volumes:' \
        '  mosquitto-data:' \
        '  mosquitto-logs:' \
        '  postgres-data:' \
        '  redis-data:' \
        'networks:' \
        '  medisentinel-net:' \
        '    driver: bridge' \
        > docker-compose.yml
fi

# 5. Check and create .env file from template if missing
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        echo "[+] Copying .env from .env.example..."
        cp .env.example .env
    else
        echo "[+] Creating default .env file..."
        printf '%s\n' \
            'SECRET_KEY=medisentinel_super_secret_key_change_in_prod' \
            'POSTGRES_USER=medi_user' \
            'POSTGRES_PASSWORD=medi_password' \
            'POSTGRES_DB=medisentinel' \
            > .env
    fi
fi

# Run the stack
echo "[+] Stopping previous running services..."
docker compose down

echo "[+] Launching Docker Compose Stack..."
docker compose up --build -d

# Build and flash ESP32 Firmware if PlatformIO is installed
if command -v pio &> /dev/null; then
    echo "[+] PlatformIO detected! Compiling ESP32 firmware to ensure hardware code is up-to-date..."
    (cd iot_devices/esp32_monitor && pio run)
    echo "[*] ESP32 firmware compiled successfully!"
    
    if [ -e /dev/ttyUSB0 ] || [ -e /dev/ttyACM0 ]; then
        echo "[+] Connected ESP32 detected! Flashing firmware automatically..."
        (cd iot_devices/esp32_monitor && pio run --target upload)
    else
        echo "[*] To upload code to your physical ESP32 device, connect it and run:"
        echo "    (cd iot_devices/esp32_monitor && pio run --target upload)"
    fi
else
    echo "[!] PlatformIO Core not found. Skipping local ESP32 compilation."
fi

echo "=========================================================="
echo "    MediSentinel Stack is fully deployed & operational!   "
echo "=========================================================="
echo " - Frontend Dashboard:    http://localhost:3000"
echo " - Backend API Docs:       http://localhost:8000/docs"
echo " - Live WebSocket Stream:  ws://localhost:8000/ws"
echo "=========================================================="
echo "[*] To run the Attacker Agent simulation, use:"
echo "    docker compose exec agents python attacker_agent.py"
echo "=========================================================="
