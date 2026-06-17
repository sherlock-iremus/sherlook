#!/bin/bash
SCRIPT_DIR="$(dirname "$(realpath "$0")")"

if [ $# -lt 2 ]; then
    echo "Usage: $0 <collection-uuid> <repo-path>"
    echo "Example: bash $0 0a0addae-bed4-4b62-9758-b30fdbf4b3f6 ../sherlook-example-collection"
    exit 1
fi

COLLECTION_UUID="$1"
REPO_PATH="$2"

export $(grep -v '^#' /Users/iremus/Dev/sherlook/.env | xargs)

deno --allow-env --allow-net --allow-read --unsafely-ignore-certificate-errors \
        "$SCRIPT_DIR/1.ts" \
        --grist-api-key "$GRIST_API_KEY" \
        --grist-base https://musicodb.sorbonne-universite.fr/api \
        --grist-doc-id t7bE5Ztv7UXC \
        --grist-files-table-id Files \
        --grist-collection-table-id Collections \
        --collection-uuid "$COLLECTION_UUID" \
        --repo "$REPO_PATH"

exit 0
