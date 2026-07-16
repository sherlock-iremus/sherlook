#!/bin/bash
SCRIPT_DIR="$(dirname "$(realpath "$0")")"

if [ $# -lt 4 ]; then
    echo "Usage: $0 <collection-uuid> <repo-path> <input-regex> <run-name>"
    echo "Example: bash $0 4f9b4989-8567-4337-8d88-f576419726c4 ../sherlook-example-collection '.*/gen/[^/]+\.pdf$' myrun"
    exit 1
fi

COLLECTION_UUID="$1"
REPO_PATH="$2"
INPUT_REGEX="$3"
RUN_NAME="$4"

source "$SCRIPT_DIR/get-env.sh"
load_env

if [ -z "$RUN_NAME" ]; then
    echo "Missing required run-name"
    exit 1
fi

deno --allow-env --allow-net --allow-read --allow-run --unsafely-ignore-certificate-errors \
        "$SCRIPT_DIR/2.2.ts" \
        --grist-api-key "$GRIST_API_KEY" \
        --grist-base https://musicodb.sorbonne-universite.fr/api \
        --grist-doc-id t7bE5Ztv7UXC \
        --grist-files-table-id Files \
        --grist-collection-table-id Collections \
        --grist-run-table-id Runs \
        --run-name "$RUN_NAME" \
        --collection-uuid "$COLLECTION_UUID" \
        --repo "$REPO_PATH" \
        --input-regex "$INPUT_REGEX"

exit 0