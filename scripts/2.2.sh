#!/bin/bash
BASE_PATH="$1"

if [ $# -lt 1 ]; then
    echo "Usage: $0 <repo-path>"
    exit 1
fi

for pdf in "$BASE_PATH"/gen/*.pdf; do
    [ -e "$pdf" ] || continue
    echo "Processing $pdf..."
    outbase="${pdf%.pdf}"
    pdftoppm -png -singlefile "$pdf" "$outbase"
done