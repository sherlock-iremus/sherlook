#!/bin/bash
SCRIPT_DIR="$(dirname "$(realpath "$0")")"

if [ $# -lt 2 ]; then
    echo "Usage: $0 <collection-uuid> <repo-path> [run-name]"
    echo "Example: bash $0 4f9b4989-8567-4337-8d88-f576419726c4 ../sherlook-example-collection"
    exit 1
fi

COLLECTION_UUID="$1"
REPO_PATH="$2"
RUN_NAME="$3"

source "$SCRIPT_DIR/get-env.sh"
load_env

if [ -n "$RUN_NAME" ]; then
    RUN_NAME_ARG=(--run-name "$RUN_NAME")
else
    RUN_NAME_ARG=()
fi

deno --allow-env --allow-net --allow-read --unsafely-ignore-certificate-errors \
        "$SCRIPT_DIR/1.ts" \
        --grist-api-key "$GRIST_API_KEY" \
        --grist-base https://musicodb.sorbonne-universite.fr/api \
        --grist-doc-id t7bE5Ztv7UXC \
        --grist-files-table-id Files \
        --grist-collection-table-id Collections \
        --grist-run-table-id Runs \
        "${RUN_NAME_ARG[@]}" \
        --collection-uuid "$COLLECTION_UUID" \
        --repo "$REPO_PATH"
       
exit 0
