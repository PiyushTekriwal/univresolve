#!/usr/bin/env bash
# =============================================================================
# run.sh — UNIV-Resolve Full Backend Startup Script
# Usage: bash run.sh
# Starts: Eureka → API Gateway → User Service → Issue Service → Worker Service → Python SLA Service → RAG API
# Stop:   Ctrl+C  (kills all background processes cleanly)
# =============================================================================

set -e

# ─── Colour helpers ─────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error()   { echo -e "${RED}[ERROR]${RESET} $*"; }
banner()  {
  echo -e "\n${BOLD}${CYAN}══════════════════════════════════════════${RESET}"
  echo -e "${BOLD}${CYAN}  $*${RESET}"
  echo -e "${BOLD}${CYAN}══════════════════════════════════════════${RESET}\n"
}

# ─── Resolve script directory (works from any CWD) ──────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESOLVE_DIR="$SCRIPT_DIR/resolve"
RAG_DIR="$SCRIPT_DIR/Rag_Project"
SLA_DIR="$SCRIPT_DIR/python_service"

# ─── PID tracking (for clean shutdown) ──────────────────────────────────────
declare -a PIDS=()

cleanup() {
    echo ""
    warn "Shutting down all services..."
    for pid in "${PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null && info "Stopped PID $pid"
        fi
    done
    success "All services stopped. Goodbye!"
    exit 0
}
trap cleanup SIGINT SIGTERM

# ─── Helper: wait for a port to be open ─────────────────────────────────────
wait_for_port() {
    local port=$1
    local name=$2
    local max_wait=${3:-90}
    local elapsed=0
    info "Waiting for $name (port $port) to start..."
    while ! (echo > /dev/tcp/localhost/$port) 2>/dev/null; do
        sleep 2
        elapsed=$((elapsed + 2))
        if [ $elapsed -ge $max_wait ]; then
            error "$name did not start within ${max_wait}s."
            error "Check logs/ directory for details."
            exit 1
        fi
        printf "."
    done
    echo ""
    success "$name is UP on port $port"
}

# ─── Helper: start a Spring Boot service via Maven wrapper ───────────────────
start_service() {
    local name=$1
    local dir=$2
    local log_file="$SCRIPT_DIR/logs/${name}.log"

    mkdir -p "$SCRIPT_DIR/logs"
    info "Starting $name ..."
    cd "$dir"
    # Use mvnw if available, fall back to mvn
    if [ -f "./mvnw" ]; then
        ./mvnw spring-boot:run > "$log_file" 2>&1 &
    elif [ -f "./mvnw.cmd" ]; then
        cmd //c mvnw.cmd spring-boot:run > "$log_file" 2>&1 &
    else
        mvn spring-boot:run > "$log_file" 2>&1 &
    fi
    local pid=$!
    PIDS+=("$pid")
    cd "$SCRIPT_DIR"
    info "$name started (PID=$pid). Logs → logs/${name}.log"
}

# ─── Java environment setup ─────────────────────────────────

export JAVA_HOME='C:/Program Files/Java/jdk-23'
export PATH="$JAVA_HOME/bin:$PATH"

echo "[INFO] JAVA_HOME=$JAVA_HOME"

if [[ ! -f "$JAVA_HOME/bin/java.exe" ]]; then
    echo "[ERROR] Java executable not found!"
    exit 1
fi

java -version

# ─── Preflight checks ────────────────────────────────────────────────────────
banner "UNIV-Resolve Backend Startup"

# Determine Maven command
if command -v mvn &>/dev/null; then
    info "Found system Maven: $(mvn --version 2>&1 | head -1)"
elif [ -f "$RESOLVE_DIR/mvnw" ]; then
    info "Using Maven Wrapper (mvnw)"
else
    error "Neither 'mvn' (system Maven) nor 'mvnw' (wrapper) found."
    error "Please install Maven: https://maven.apache.org/install.html"
    exit 1
fi

# Check Python
PYTHON_CMD="python"
if command -v python3 &>/dev/null; then
    PYTHON_CMD="python3"
elif [ -f "C:/Users/KIIT0001/AppData/Local/Programs/Python/Python310/python.exe" ]; then
    PYTHON_CMD="C:/Users/KIIT0001/AppData/Local/Programs/Python/Python310/python.exe"
fi

RAG_SKIP=false
if ! command -v "$PYTHON_CMD" &>/dev/null && [ ! -f "$PYTHON_CMD" ]; then
    warn "Python not found — Python SLA & RAG services will be skipped."
    RAG_SKIP=true
fi

echo ""

# ─── 1. Build all services from parent POM (skip tests for speed) ────────────
banner "Step 1 / 8 — Building all microservices (skip tests)"
cd "$RESOLVE_DIR"
if [ -f "./mvnw" ]; then
    ./mvnw clean package -DskipTests
elif command -v mvn &>/dev/null; then
    mvn clean package -DskipTests
else
    cmd //c mvnw.cmd clean package -DskipTests
fi
success "Build complete."
cd "$SCRIPT_DIR"

# ─── 2. Eureka Server ─────────────────────────────────────────────────────────
banner "Step 2 / 8 — Starting Eureka Service Registry (port 8761)"
start_service "eureka-server" "$RESOLVE_DIR/eureka-server"
wait_for_port 8761 "Eureka Server" 120

# ─── 3. API Gateway ──────────────────────────────────────────────────────────
banner "Step 3 / 8 — Starting API Gateway (port 8080)"
start_service "api-gateway" "$RESOLVE_DIR/api-gateway"
wait_for_port 8080 "API Gateway" 90

# ─── 4. User Service ─────────────────────────────────────────────────────────
banner "Step 4 / 8 — Starting User Service (port 8081)"
start_service "user-service" "$RESOLVE_DIR/user-service"
wait_for_port 8081 "User Service" 90

# ─── 5. Issue Service ────────────────────────────────────────────────────────
banner "Step 5 / 8 — Starting Issue Service (port 8082)"
start_service "issue-service" "$RESOLVE_DIR/issue-service"
wait_for_port 8082 "Issue Service" 90

# ─── 6. Worker Service ───────────────────────────────────────────────────────
banner "Step 6 / 8 — Starting Worker Service (port 8083)"
start_service "worker-service" "$RESOLVE_DIR/worker-service"
wait_for_port 8083 "Worker Service" 90

# ─── 7. Python SLA Management & Prediction Service ───────────────────────────
if [ "$RAG_SKIP" = false ]; then
    banner "Step 7 / 8 — Starting Python SLA & Prediction Service (port 8002)"
    mkdir -p "$SCRIPT_DIR/logs"
    cd "$SLA_DIR"
    "$PYTHON_CMD" -m uvicorn app:app --host 127.0.0.1 --port 8002 > "$SCRIPT_DIR/logs/sla-service.log" 2>&1 &
    SLA_PID=$!
    PIDS+=("$SLA_PID")
    cd "$SCRIPT_DIR"
    wait_for_port 8002 "Python SLA Service" 60
fi

# ─── 8. RAG Chat API (FastAPI / Python) ──────────────────────────────────────
if [ "$RAG_SKIP" = false ]; then
    banner "Step 8 / 8 — Starting RAG Chat API (port 8001)"
    mkdir -p "$SCRIPT_DIR/logs"
    cd "$RAG_DIR"
    # Activate virtual environment if present
    if   [ -f "venv/Scripts/activate" ]; then source venv/Scripts/activate
    elif [ -f "venv/bin/activate" ];     then source venv/bin/activate
    fi
    "$PYTHON_CMD" -m uvicorn rag_api:app --host 127.0.0.1 --port 8001 > "$SCRIPT_DIR/logs/rag-api.log" 2>&1 &
    RAG_PID=$!
    PIDS+=("$RAG_PID")
    cd "$SCRIPT_DIR"
    wait_for_port 8001 "RAG Chat API" 60
fi

# ─── All done ────────────────────────────────────────────────────────────────
banner "✅  All Services Running!"
echo -e "${GREEN}  ✔  Eureka Dashboard   →  http://localhost:8761${RESET}"
echo -e "${GREEN}  ✔  API Gateway        →  http://localhost:8080  (frontend entry point)${RESET}"
echo -e "${GREEN}  ✔  User Service       →  http://localhost:8081/api/users${RESET}"
echo -e "${GREEN}  ✔  Issue Service      →  http://localhost:8082/api/issues${RESET}"
echo -e "${GREEN}  ✔  Worker Service     →  http://localhost:8083/api/workers${RESET}"
if [ "$RAG_SKIP" = false ]; then
echo -e "${GREEN}  ✔  Python SLA Service →  http://localhost:8002/health${RESET}"
echo -e "${GREEN}  ✔  RAG Chat API       →  http://localhost:8001/health${RESET}"
fi
echo ""
echo -e "${CYAN}  Admin  →  Email: admin@kiit.ac.in  |  Password: admin123${RESET}"
echo ""
echo -e "${YELLOW}  Log files are in: logs/  (one per service)${RESET}"
echo -e "${YELLOW}  Press Ctrl+C to stop all services.${RESET}"
echo ""

# ─── Keep script alive until Ctrl+C ──────────────────────────────────────────
wait
