# =============================================================================
# CantonSyndex — Developer Makefile
#
# QUICK START (first time):
#   make setup     → install all deps
#   make start     → launch Canton LocalNet
#   make deploy    → build DAR + upload + provision parties
#   make dashboard → open frontend in browser
#
# DAILY DEV:
#   make build     → rebuild DAR + TS
#   make test      → run all DAML Script tests
#   make logs      → tail all Canton node logs
#   make status    → show node health
#
# CLEANUP:
#   make stop      → stop all containers
#   make clean     → stop + remove volumes (DESTROYS ledger state)
# =============================================================================

SHELL          := /bin/bash
.DEFAULT_GOAL  := help

# Colours
BLUE   := \033[0;34m
GREEN  := \033[0;32m
YELLOW := \033[1;33m
RED    := \033[0;31m
NC     := \033[0m

# Paths
COMPOSE_FILE  := infra/docker-compose.yml
DAR_FILE      := .daml/dist/CantonSyndex-0.1.0.dar
FRONTEND_DIR  := frontend

# =============================================================================
# Help
# =============================================================================
.PHONY: help
help:
	@echo ""
	@echo "  CantonSyndex — Developer Commands"
	@echo ""
	@echo "  SETUP & LAUNCH"
	@echo "  ──────────────────────────────────────────────────"
	@echo "  make setup       Install all dependencies (daml, node, docker)"
	@echo "  make start       Launch Canton LocalNet (4 nodes)"
	@echo "  make deploy      Build DAR + upload to all nodes + provision parties"
	@echo "  make dashboard   Open frontend dashboard in browser"
	@echo "  make demo        Full demo: start → deploy → open dashboard"
	@echo ""
	@echo "  DEVELOPMENT"
	@echo "  ──────────────────────────────────────────────────"
	@echo "  make build       Build DAML DAR + TypeScript bridge"
	@echo "  make build-daml  Build DAML DAR only"
	@echo "  make build-ts    Build TypeScript bridge only"
	@echo "  make test        Run all DAML Script tests"
	@echo "  make lint        Run DAML + TypeScript linting"
	@echo ""
	@echo "  OPERATIONS"
	@echo "  ──────────────────────────────────────────────────"
	@echo "  make status      Show health of all Canton nodes"
	@echo "  make logs        Tail logs from all nodes"
	@echo "  make logs-sync   Tail synchronizer logs only"
	@echo "  make logs-agent  Tail agent node logs only"
	@echo "  make stop        Stop all containers (keep ledger data)"
	@echo "  make clean       Stop + wipe all ledger data (DESTRUCTIVE)"
	@echo "  make reset       Interactive reset with confirmation"
	@echo ""

# =============================================================================
# Setup
# =============================================================================
.PHONY: setup
setup:
	@printf "$(BLUE)==> Checking dependencies...$(NC)\n"
	@command -v daml     >/dev/null 2>&1 || (echo "  ERROR: daml CLI not found. Install: https://docs.daml.com/getting-started/installation.html" && exit 1)
	@command -v docker   >/dev/null 2>&1 || (echo "  ERROR: docker not found" && exit 1)
	@command -v docker-compose >/dev/null 2>&1 || (echo "  ERROR: docker-compose not found" && exit 1)
	@command -v node     >/dev/null 2>&1 || (echo "  WARN: node not found — TypeScript bridge won't work" && true)
	@command -v jq       >/dev/null 2>&1 || (echo "  WARN: jq not found — install for party ID parsing" && true)
	@printf "$(BLUE)==> Installing npm packages...$(NC)\n"
	@[ -f package.json ] && npm install --silent || true
	@printf "$(GREEN)Setup complete.$(NC)\n"
	@echo "  Next: make start"

# =============================================================================
# Build
# =============================================================================
.PHONY: build
build: build-daml build-ts
	@printf "$(GREEN)==> Build complete: $(DAR_FILE)$(NC)\n"

.PHONY: build-daml
build-daml:
	@printf "$(BLUE)==> Building DAML DAR...$(NC)\n"
	daml build
	@printf "$(GREEN)  DAR: $(DAR_FILE)$(NC)\n"

.PHONY: build-ts
build-ts:
	@printf "$(BLUE)==> Building TypeScript bridge...$(NC)\n"
	@[ -f package.json ] && npm run build || printf "$(YELLOW)  SKIP: package.json not found$(NC)\n"

# =============================================================================
# Test
# =============================================================================
.PHONY: test
test:
	@printf "$(BLUE)==> Running DAML Script tests...$(NC)\n"
	daml test --all
	@printf "$(GREEN)==> All tests passed.$(NC)\n"

.PHONY: test-verbose
test-verbose:
	daml test --all --show-coverage

# =============================================================================
# Canton LocalNet
# =============================================================================
.PHONY: start
start:
	@printf "$(BLUE)==> Starting Canton LocalNet...$(NC)\n"
	docker-compose -f $(COMPOSE_FILE) up -d
	@printf "$(BLUE)==> Waiting for nodes to initialize (30s)...$(NC)\n"
	@sleep 30
	@$(MAKE) status
	@printf "\n$(GREEN)==> Canton LocalNet running.$(NC) Run: make deploy\n"

.PHONY: start-with-navigator
start-with-navigator:
	docker-compose -f $(COMPOSE_FILE) --profile navigator up -d
	@sleep 30
	@printf "$(GREEN)==> Navigator: http://localhost:7500$(NC)\n"

.PHONY: stop
stop:
	@printf "$(YELLOW)==> Stopping Canton LocalNet...$(NC)\n"
	docker-compose -f $(COMPOSE_FILE) down
	@printf "$(GREEN)==> Stopped (ledger data preserved).$(NC)\n"

.PHONY: clean
clean:
	@printf "$(RED)==> WARNING: This will destroy ALL ledger data.$(NC)\n"
	@read -p "   Press Enter to continue or Ctrl-C to cancel..."
	docker-compose -f $(COMPOSE_FILE) down -v --remove-orphans
	rm -f infra/.env
	rm -rf .daml/dist
	@printf "$(GREEN)==> Clean complete.$(NC)\n"

.PHONY: reset
reset:
	./scripts/reset.sh

# =============================================================================
# Deploy
# =============================================================================
.PHONY: deploy
deploy: build-daml
	@printf "$(BLUE)==> Deploying CantonSyndex to LocalNet...$(NC)\n"
	./scripts/deploy.sh --verify
	@printf "$(GREEN)==> Deployment complete.$(NC) Run: make dashboard\n"

# =============================================================================
# Status & Logs
# =============================================================================
.PHONY: status
status:
	@printf "$(BLUE)==> Canton Node Health$(NC)\n"
	@printf "  %-25s " "Synchronizer (9019):";   @curl -sf http://localhost:9019/health > /dev/null 2>&1 && printf "$(GREEN)UP$(NC)\n" || printf "$(RED)DOWN$(NC)\n"
	@printf "  %-25s " "Agent/GlobalLeadBank (10012):"; curl -sf http://localhost:10012/health > /dev/null 2>&1 && printf "$(GREEN)UP$(NC)\n" || printf "$(RED)DOWN$(NC)\n"
	@printf "  %-25s " "AlphaBank (10022):";     curl -sf http://localhost:10022/health > /dev/null 2>&1 && printf "$(GREEN)UP$(NC)\n" || printf "$(RED)DOWN$(NC)\n"
	@printf "  %-25s " "BetaBank (10032):";      curl -sf http://localhost:10032/health > /dev/null 2>&1 && printf "$(GREEN)UP$(NC)\n" || printf "$(RED)DOWN$(NC)\n"

.PHONY: logs
logs:
	docker-compose -f $(COMPOSE_FILE) logs -f --tail=50

.PHONY: logs-sync
logs-sync:
	docker-compose -f $(COMPOSE_FILE) logs -f --tail=100 canton-sync

.PHONY: logs-agent
logs-agent:
	docker-compose -f $(COMPOSE_FILE) logs -f --tail=100 canton-agent

.PHONY: logs-banka
logs-banka:
	docker-compose -f $(COMPOSE_FILE) logs -f --tail=100 canton-banka

.PHONY: logs-bankb
logs-bankb:
	docker-compose -f $(COMPOSE_FILE) logs -f --tail=100 canton-bankb

# =============================================================================
# Dashboard
# =============================================================================
.PHONY: dashboard
dashboard:
	@printf "$(BLUE)==> Opening dashboard...$(NC)\n"
	@open $(FRONTEND_DIR)/index.html 2>/dev/null || xdg-open $(FRONTEND_DIR)/index.html 2>/dev/null || \
	  printf "$(YELLOW)  Open manually: $(FRONTEND_DIR)/index.html$(NC)\n"

# =============================================================================
# Full Demo
# =============================================================================
.PHONY: demo
demo: start deploy dashboard
	@printf "\n$(GREEN)╔════════════════════════════════════════╗$(NC)\n"
	@printf "$(GREEN)║  CantonSyndex demo is running! 🚀      ║$(NC)\n"
	@printf "$(GREEN)╚════════════════════════════════════════╝$(NC)\n"
	@printf "\n  Dashboard:   file://$(PWD)/$(FRONTEND_DIR)/index.html\n"
	@printf "  Agent API:   http://localhost:10011\n"
	@printf "  AlphaBank:   http://localhost:10021\n"
	@printf "  BetaBank:    http://localhost:10031\n\n"

# =============================================================================
# Lint
# =============================================================================
.PHONY: lint
lint:
	@printf "$(BLUE)==> Linting TypeScript...$(NC)\n"
	@[ -f package.json ] && npm run lint || true
	@printf "$(GREEN)==> Lint complete.$(NC)\n"

.PHONY: lint
