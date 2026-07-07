#!/bin/bash
SCRIPT_DIR="$(dirname "$(realpath "$0")")"

if [ $# -lt 4 ]; then
    echo "Usage: $0 <collection-uuid> <repo-path> <input-files-regex> <prompt> [run-name]"
    echo "Example: bash $0 df037d10-9c54-4c7f-a67a-f86b8a6c485a ../sherlook-example-collection '.*/dat/.*\.json$' 'Quel pokemon de type psy est le plus grand ?'"
    exit 1
fi

COLLECTION_UUID="$1"
REPO_PATH="$2"
INPUT_FILES_REGEX="$3"
PROMPT="$4"
RUN_NAME="$5"

export $(grep -v '^#' /Users/iremus/Dev/sherlook/.env | xargs)

if [ -n "$RUN_NAME" ]; then
    RUN_NAME_ARG=(--run-name "$RUN_NAME")
else
    RUN_NAME_ARG=()
fi

deno --allow-env --allow-net --allow-read --allow-write --unsafely-ignore-certificate-errors \
    "$SCRIPT_DIR/4.1.ts" \
        --grist-api-key "$GRIST_API_KEY" \
        --grist-base https://musicodb.sorbonne-universite.fr/api \
        --grist-doc-id t7bE5Ztv7UXC \
        --grist-files-table-id Files \
        --grist-collection-table-id Collections \
        --grist-run-table-id Runs \
    "${RUN_NAME_ARG[@]}" \
    --collection-uuid "$COLLECTION_UUID" \
    --repo "$REPO_PATH" \
    --input-files-regex "$INPUT_FILES_REGEX" \
    --prompt "$PROMPT" \
    --albert-base "https://albert.api.etalab.gouv.fr/" \
    --albert-api-key "$ALBERT_API_KEY"

exit 0