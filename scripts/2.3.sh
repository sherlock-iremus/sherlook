#!/bin/bash
SCRIPT_DIR="$(dirname "$(realpath "$0")")"

if [ $# -lt 2 ]; then
    echo "Usage: $0 <collection-uuid> <repo-path> [--run-name <name>] [--put-file-name-in-txt]"
    echo "Example: bash $0 4f9b4989-8567-4337-8d88-f576419726c4 ../sherlook-example-collection --put-file-name-in-txt"
    exit 1
fi

# Positional/flag parsing
COLLECTION_UUID=""
REPO_PATH=""
RUN_NAME=""
PUT_FILE_NAME_IN_TXT=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --put-file-name-in-txt)
            PUT_FILE_NAME_IN_TXT=true
            shift
            ;;
        --run-name)
            RUN_NAME="$2"
            shift 2
            ;;
        --*)
            echo "Unknown option: $1"
            exit 1
            ;;
        *)
            if [ -z "$COLLECTION_UUID" ]; then
                COLLECTION_UUID="$1"
            elif [ -z "$REPO_PATH" ]; then
                REPO_PATH="$1"
            else
                echo "Too many positional arguments: $1"
                exit 1
            fi
            shift
            ;;
    esac
done

if [ -z "$COLLECTION_UUID" ] || [ -z "$REPO_PATH" ]; then
    echo "Missing required arguments."
    echo "Usage: $0 <collection-uuid> <repo-path> [--run-name <name>] [--put-file-name-in-txt]"
    exit 1
fi

export $(grep -v '^#' /Users/iremus/Dev/sherlook/.env | xargs)

if [ -n "$RUN_NAME" ]; then
    RUN_NAME_ARG=(--run-name "$RUN_NAME")
else
    RUN_NAME_ARG=()
fi

if [ "$PUT_FILE_NAME_IN_TXT" = true ]; then
    PUT_FLAG=(--put-file-name-in-txt)
else
    PUT_FLAG=()
fi

deno --allow-env --allow-net --allow-read --allow-write --unsafely-ignore-certificate-errors \
        "$SCRIPT_DIR/2.3.ts" \
        --grist-api-key "$GRIST_API_KEY" \
        --grist-base https://musicodb.sorbonne-universite.fr/api \
        --grist-doc-id t7bE5Ztv7UXC \
        --grist-files-table-id Files \
        --grist-collection-table-id Collections \
        --grist-run-table-id Runs \
        "${RUN_NAME_ARG[@]}" \
        "${PUT_FLAG[@]}" \
        --collection-uuid "$COLLECTION_UUID" \
        --repo "$REPO_PATH"

exit 0
