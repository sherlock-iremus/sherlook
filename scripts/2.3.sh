#!/bin/bash
SCRIPT_DIR="$(dirname "$(realpath "$0")")"

if [ $# -lt 4 ]; then
    echo "Usage: $0 <collection-uuid> <repo-path> <input-regex> <run-name> [--put-file-name-in-txt]"
    echo "Example: bash $0 4f9b4989-8567-4337-8d88-f576419726c4 ../sherlook-example-collection '.*/gen/[^/]+\.pdf$' myrun --put-file-name-in-txt"
    exit 1
fi

COLLECTION_UUID="$1"
REPO_PATH="$2"
INPUT_REGEX="$3"
RUN_NAME="$4"
shift 4
PUT_FILE_NAME_IN_TXT=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --put-file-name-in-txt)
            PUT_FILE_NAME_IN_TXT=true
            shift
            ;;
        --*)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

if [ -z "$COLLECTION_UUID" ] || [ -z "$REPO_PATH" ] || [ -z "$INPUT_REGEX" ] || [ -z "$RUN_NAME" ]; then
    echo "Missing required arguments."
    echo "Usage: $0 <collection-uuid> <repo-path> <input-regex> <run-name> [--put-file-name-in-txt]"
    exit 1
fi

source "$SCRIPT_DIR/get-env.sh"
load_env

RUN_NAME_ARG=(--run-name "$RUN_NAME")

if [ "$PUT_FILE_NAME_IN_TXT" = true ]; then
    PUT_FLAG=(--put-file-name-in-txt)
else
    PUT_FLAG=()
fi

if [ -n "$INPUT_REGEX" ]; then
    INPUT_REGEX_ARG=(--input-regex "$INPUT_REGEX")
else
    INPUT_REGEX_ARG=()
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
        "${INPUT_REGEX_ARG[@]}" \
        --collection-uuid "$COLLECTION_UUID" \
        --repo "$REPO_PATH"

exit 0
