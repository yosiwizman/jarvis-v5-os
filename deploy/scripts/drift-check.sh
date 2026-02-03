#!/usr/bin/env bash
#
# drift-check.sh - Deployment drift detection for AKIOR
#
# This script compares the git repository HEAD with running container image labels
# to detect if containers are running code different from the current repo state.
#
# Usage:
#   ./drift-check.sh              # Run drift check
#   ./drift-check.sh --json       # Output JSON for programmatic use
#   ./drift-check.sh --quiet      # Exit code only (0=no drift, 1=drift detected)
#
# Environment variables:
#   AKIOR_REPO_DIR    - Path to the git repository (default: /opt/jarvis/JARVIS-V5-OS)
#   AKIOR_COMPOSE_FILE - Path to compose file (default: deploy/compose.jarvis.yml)
#
# Exit codes:
#   0 - No drift detected
#   1 - Drift detected
#   2 - Error (missing dependencies, can't read repo, etc.)
#

set -euo pipefail

# Configuration
REPO_DIR="${AKIOR_REPO_DIR:-/opt/jarvis/JARVIS-V5-OS}"
COMPOSE_FILE="${AKIOR_COMPOSE_FILE:-deploy/compose.jarvis.yml}"
OUTPUT_MODE="text"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --json)
      OUTPUT_MODE="json"
      shift
      ;;
    --quiet|-q)
      OUTPUT_MODE="quiet"
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [--json|--quiet]"
      echo ""
      echo "Checks for deployment drift between git repo and running containers."
      echo ""
      echo "Options:"
      echo "  --json    Output JSON format"
      echo "  --quiet   Exit code only (0=no drift, 1=drift)"
      echo ""
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 2
      ;;
  esac
done

# Check dependencies
check_deps() {
  local missing=()
  command -v git >/dev/null 2>&1 || missing+=("git")
  command -v docker >/dev/null 2>&1 || missing+=("docker")
  
  if [[ ${#missing[@]} -gt 0 ]]; then
    if [[ "$OUTPUT_MODE" == "json" ]]; then
      echo '{"ok": false, "error": "Missing dependencies: '"${missing[*]}"'"}'
    elif [[ "$OUTPUT_MODE" == "text" ]]; then
      echo "ERROR: Missing required commands: ${missing[*]}" >&2
    fi
    exit 2
  fi
}

# Get git HEAD SHA from repo
get_repo_sha() {
  if [[ ! -d "$REPO_DIR/.git" ]]; then
    echo "unknown"
    return
  fi
  
  cd "$REPO_DIR"
  git rev-parse HEAD 2>/dev/null || echo "unknown"
}

# Get SHA from a running container's image label
get_container_sha() {
  local container_name="$1"
  
  # Try to get the revision label from the container's image
  local sha
  sha=$(docker inspect --format='{{index .Config.Labels "org.opencontainers.image.revision"}}' "$container_name" 2>/dev/null || echo "")
  
  if [[ -z "$sha" || "$sha" == "<no value>" ]]; then
    # Fallback: try to get GIT_SHA env var from container
    sha=$(docker inspect --format='{{range .Config.Env}}{{println .}}{{end}}' "$container_name" 2>/dev/null | grep '^GIT_SHA=' | cut -d'=' -f2 || echo "")
  fi
  
  if [[ -z "$sha" ]]; then
    echo "unknown"
  else
    echo "$sha"
  fi
}

# Check if container is running
is_container_running() {
  local container_name="$1"
  docker inspect --format='{{.State.Running}}' "$container_name" 2>/dev/null | grep -q "true"
}

# Main drift check
main() {
  check_deps
  
  local timestamp
  timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  
  # Get repo SHA
  local repo_sha
  repo_sha=$(get_repo_sha)
  
  # Get container SHAs
  local server_sha="not_running"
  local web_sha="not_running"
  
  if is_container_running "jarvis-server"; then
    server_sha=$(get_container_sha "jarvis-server")
  fi
  
  if is_container_running "jarvis-web"; then
    web_sha=$(get_container_sha "jarvis-web")
  fi
  
  # Determine drift
  local drift="false"
  local drift_details=()
  
  if [[ "$repo_sha" == "unknown" ]]; then
    drift_details+=("Repository SHA unknown (not a git repo or git error)")
  else
    if [[ "$server_sha" != "unknown" && "$server_sha" != "not_running" && "$server_sha" != "$repo_sha" ]]; then
      drift="true"
      drift_details+=("Server container SHA mismatch: expected $repo_sha, got $server_sha")
    fi
    
    if [[ "$web_sha" != "unknown" && "$web_sha" != "not_running" && "$web_sha" != "$repo_sha" ]]; then
      drift="true"
      drift_details+=("Web container SHA mismatch: expected $repo_sha, got $web_sha")
    fi
  fi
  
  # Handle not running containers as potential drift
  if [[ "$server_sha" == "not_running" ]]; then
    drift_details+=("Server container not running")
  fi
  if [[ "$web_sha" == "not_running" ]]; then
    drift_details+=("Web container not running")
  fi
  
  # Output results
  case "$OUTPUT_MODE" in
    json)
      local details_json="[]"
      if [[ ${#drift_details[@]} -gt 0 ]]; then
        details_json=$(printf '%s\n' "${drift_details[@]}" | jq -R . | jq -s .)
      fi
      
      jq -n \
        --argjson ok "$(if [[ $drift == "false" ]]; then echo "true"; else echo "false"; fi)" \
        --arg expectedSha "$repo_sha" \
        --arg serverSha "$server_sha" \
        --arg webSha "$web_sha" \
        --argjson drift "$drift" \
        --argjson driftDetails "$details_json" \
        --arg time "$timestamp" \
        '{
          ok: $ok,
          expectedSha: $expectedSha,
          running: {
            server: $serverSha,
            web: $webSha
          },
          drift: $drift,
          driftDetails: $driftDetails,
          time: $time
        }'
      ;;
    
    text)
      echo "=== AKIOR Deployment Drift Check ==="
      echo "Time: $timestamp"
      echo ""
      echo "Repository SHA: $repo_sha"
      echo "Server SHA:     $server_sha"
      echo "Web SHA:        $web_sha"
      echo ""
      
      if [[ "$drift" == "true" ]]; then
        echo "⚠️  DRIFT DETECTED"
        for detail in "${drift_details[@]}"; do
          echo "  - $detail"
        done
      else
        echo "✅ No drift detected"
        if [[ ${#drift_details[@]} -gt 0 ]]; then
          echo ""
          echo "Notes:"
          for detail in "${drift_details[@]}"; do
            echo "  - $detail"
          done
        fi
      fi
      ;;
    
    quiet)
      # No output in quiet mode
      ;;
  esac
  
  # Exit with appropriate code
  if [[ "$drift" == "true" ]]; then
    exit 1
  fi
  exit 0
}

main "$@"
