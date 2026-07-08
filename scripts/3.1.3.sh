#!/bin/bash
SCRIPT_DIR="$(dirname "$(realpath "$0")")"

if [ $# -lt 4 ]; then
    echo "Usage: $0 <collection-uuid> <repo-path> <input-regex> <prompt> [run-name]"
    echo "Example: bash scripts/3.1.3.sh e99012b1-51be-4f2b-8105-9deec5d474f4 ../sherlook-example-collection '.*/gen/[^/]+\\.txt$' 'Génère moi un csv avec les colonnes suivantes : numéro du pokemon, nom du pokemon, height, weight, type, description' pokemon-structure"
    exit 1
fi

COLLECTION_UUID="$1"
REPO_PATH="$2"
INPUT_REGEX="$3"
PROMPT="$4"
RUN_NAME="$5"

source "$SCRIPT_DIR/get-env.sh"
load_env

if [ -n "$RUN_NAME" ]; then
    RUN_NAME_ARG=(--run-name "$RUN_NAME")
else
    RUN_NAME_ARG=()
fi

deno --allow-env --allow-net --allow-read --allow-write --unsafely-ignore-certificate-errors \
    "$SCRIPT_DIR/3.1.3.ts" \
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
    --prompt "$PROMPT" \
    --albert-base "https://albert.api.etalab.gouv.fr/" \
    --albert-api-key "$ALBERT_API_KEY"

exit 0
