#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(dirname "$(realpath "$0")")"

if [ "$#" -lt 4 ]; then
  echo "Usage: $0 {collection.UUID} {repo.path} '{input_files_regex}' {run_name}"
  exit 1
fi

COLLECTION_UUID="$1"
REPO="$2"
INPUT_REGEX="$3"
RUN_NAME="$4"

source "$SCRIPT_DIR/get-env.sh"
load_env

# Optional: path to python (chandra runner). Default: python3
CHANDRA_PYTHON="${CHANDRA_PYTHON:-python3}"

deno run --allow-read --allow-run --allow-net --allow-env --unsafely-ignore-certificate-errors \
  scripts/2.4.2.ts \
  --repo "${REPO}" \
  --collection-uuid "${COLLECTION_UUID}" \
  --input-regex "${INPUT_REGEX}" \
  --run-name "${RUN_NAME}" \
  --grist-api-key "$GRIST_API_KEY" \
  --grist-base "https://musicodb.sorbonne-universite.fr/api" \
  --grist-doc-id "t7bE5Ztv7UXC" \
  --grist-files-table-id "Files" \
  --grist-run-table-id "Runs" \
  --grist-collection-table-id "Collections" \
  --chandra-cmd "${CHANDRA_PYTHON}"
