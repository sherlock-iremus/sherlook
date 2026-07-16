#!/bin/bash
SCRIPT_DIR="$(dirname "$(realpath "$0")")"

if [ $# -lt 4 ]; then
	echo "Usage: $0 <collection-uuid> <repo-path> <input-regex> <run-name>"
	echo "Example: $0 bad5f59a-5305-430a-92af-0d712001e474 ../koechlin-ephemerides '.*/gen/KO_Eph_1950-14\\.pdf$' myrun"
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
	"$SCRIPT_DIR/2.4.1.ts" \
	--collection-uuid "$COLLECTION_UUID" \
	--repo "$REPO_PATH" \
	--input-regex "$INPUT_REGEX" \
	--albert-base "${ALBERT_BASE:-https://albert.api.etalab.gouv.fr/}" \
	--albert-api-key "$ALBERT_API_KEY" \
	--datalab-base "${DATALAB_BASE:-https://www.datalab.to/api/}" \
	--datalab-api-key "$DATALAB_API_KEY" \
	--grist-api-key "$GRIST_API_KEY" \
	--grist-base "${GRIST_BASE:-https://musicodb.sorbonne-universite.fr/api}" \
	--grist-doc-id "${GRIST_DOC_ID:-t7bE5Ztv7UXC}" \
	--grist-files-table-id "${GRIST_FILES_TABLE_ID:-Files}" \
	--grist-collection-table-id "${GRIST_COLLECTION_TABLE_ID:-Collections}" \
	--grist-run-table-id "${GRIST_RUN_TABLE_ID:-Runs}" \
	--put-file-name-in-txt true \
	"${RUN_NAME_ARG[@]}"

exit 0