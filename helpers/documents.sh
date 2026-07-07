export $(grep -v '^#' /Users/iremus/Dev/sherlook/.env | xargs)

curl -sS "https://albert.api.etalab.gouv.fr/v1/documents?collection_id=249295" \
  -H "Authorization: Bearer $ALBERT_API_KEY" \
  -H "Content-Type: application/json"