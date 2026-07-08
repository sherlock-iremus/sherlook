#!/bin/bash

load_env() {
  local base_dir
  base_dir="$(dirname "$(realpath "${BASH_SOURCE[0]}")")/.."
  local env_file="$base_dir/.env"

  if [ ! -f "$env_file" ]; then
    echo "Env file not found: $env_file" >&2
    return 1
  fi

  export $(grep -v '^#' "$env_file" | xargs)
}
