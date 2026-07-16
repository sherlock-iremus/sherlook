#!/bin/bash
SCRIPT_DIR="$(dirname "$(realpath "$0")")"

if [ $# -lt 4 ]; then
    echo "Usage: $0 <collection-uuid> <repo-path> <input-regex> <run-name>"
    echo "Example: bash scripts/3.1.1.sh e99012b1-51be-4f2b-8105-9deec5d474f4 ../sherlook-example-collection '.*/gen/[^/]+\.txt$' structure"
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
RUN_NAME_ARG=(--run-name "$RUN_NAME")

deno --allow-env --allow-net --allow-read --allow-write --unsafely-ignore-certificate-errors \
    "$SCRIPT_DIR/3.1.1.ts" \
        --grist-api-key "$GRIST_API_KEY" \
        --grist-base https://musicodb.sorbonne-universite.fr/api \
        --grist-doc-id t7bE5Ztv7UXC \
        --grist-files-table-id Files \
        --grist-collection-table-id Collections \
        --grist-run-table-id Runs \
    "${RUN_NAME_ARG[@]}" \
    --collection-uuid "$COLLECTION_UUID" \
    --repo "$REPO_PATH" \
    --input-regex "$INPUT_REGEX" \
    --albert-base "https://albert.api.etalab.gouv.fr" \
    --albert-api-key "$ALBERT_API_KEY"

exit 0