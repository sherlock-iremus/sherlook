export $(grep -v '^#' /Users/iremus/Dev/sherlook/.env | xargs)

curl -sS "https://albert.api.etalab.gouv.fr/v1/models" \
  -H "Authorization: Bearer $ALBERT_API_KEY"

