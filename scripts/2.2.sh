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

# Convert all PDFs in gen/ to PNG and collect input/output paths
DECLARE_A="declare -a INPUT_PDFS"
eval "$DECLARE_A"
DECLARE_B="declare -a OUTPUT_PNGS"
eval "$DECLARE_B"
FILE_INDEX=0

for pdf in "$REPO_PATH"/gen/*.pdf; do
    [ -e "$pdf" ] || continue
    echo "Processing $pdf..."
    outbase="${pdf%.pdf}"
    pdftoppm -png -singlefile "$pdf" "$outbase"
    INPUT_PDFS[$FILE_INDEX]="$pdf"
    OUTPUT_PNGS[$FILE_INDEX]="${outbase}.png"
    FILE_INDEX=$((FILE_INDEX+1))
done

echo "PDF to PNG conversion complete ✅"

# Call 2.2.ts to record generated PNGs in Grist
if [ -n "$RUN_NAME" ]; then
    RUN_NAME_ARG=(--run-name "$RUN_NAME")
else
    RUN_NAME_ARG=()
fi

INPUT_ARGS=()
for pdf in "${INPUT_PDFS[@]}"; do
    INPUT_ARGS+=(--input-file "$pdf")
done

OUTPUT_ARGS=()
for png in "${OUTPUT_PNGS[@]}"; do
    OUTPUT_ARGS+=(--output-file "$png")
done

deno --allow-env --allow-net --allow-read --unsafely-ignore-certificate-errors \
        "$SCRIPT_DIR/2.2.ts" \
        --grist-api-key "$GRIST_API_KEY" \
        --grist-base https://musicodb.sorbonne-universite.fr/api \
        --grist-doc-id t7bE5Ztv7UXC \
        --grist-files-table-id Files \
        --grist-collection-table-id Collections \
        --grist-run-table-id Runs \
        "${RUN_NAME_ARG[@]}" \
        --collection-uuid "$COLLECTION_UUID" \
        --repo "$REPO_PATH" \
        "${INPUT_ARGS[@]}" \
        "${OUTPUT_ARGS[@]}"

exit 0