export $(grep -v '^#' /Users/iremus/Dev/sherlook/.env | xargs)

curl -sS "https://albert.api.etalab.gouv.fr/v1/documents/4674477/chunks" \
  -H "Authorization: Bearer $ALBERT_API_KEY" \
  -H "Content-Type: application/json"
