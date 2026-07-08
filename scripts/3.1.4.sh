#!/bin/bash
SCRIPT_DIR="$(dirname "$(realpath "$0")")"

if [ $# -lt 3 ]; then
    echo "Usage: $0 <collection-uuid> <repo-path> <input-csv-regex> [run-name]"
    echo "Example: bash scripts/3.1.4.sh e99012b1-51be-4c7f-a67a-f86b8a6c485a ../sherlook-example-collection '.*/dat/Albert Extract Structure from Files-2026-07-08T08-47-31-201Z/structure\.csv$'"
    exit 1
fi

COLLECTION_UUID="$1"
REPO_PATH="$2"
INPUT_REGEX="$3"
RUN_NAME="$4"

source "$SCRIPT_DIR/get-env.sh"
load_env

if [ -n "$RUN_NAME" ]; then
    RUN_NAME_ARG=(--run-name "$RUN_NAME")
else
    RUN_NAME_ARG=()
fi

deno --allow-env --allow-read --allow-write --allow-net --unsafely-ignore-certificate-errors \
    "$SCRIPT_DIR/3.1.4.ts" \
        --grist-api-key "$GRIST_API_KEY" \
        --grist-base https://musicodb.sorbonne-universite.fr/api \
        --grist-doc-id t7bE5Ztv7UXC \
        --grist-files-table-id Files \
        --grist-collection-table-id Collections \
        --grist-run-table-id Runs \
    "${RUN_NAME_ARG[@]}" \
    --collection-uuid "$COLLECTION_UUID" \
    --repo "$REPO_PATH" \
    --input-regex "$INPUT_REGEX"

exit 0
