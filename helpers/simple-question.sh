export $(grep -v '^#' /Users/iremus/Dev/sherlook/.env | xargs)

curl -sS "https://albert.api.etalab.gouv.fr/v1/chat/completions" \
  -H "Authorization: Bearer $ALBERT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "mistralai/Ministral-3-8B-Instruct-2512",
    "messages": [
      {"role": "system", "content": "Tu réponds en français, de façon concise."},
      {"role": "user", "content": "Explique moi en une phrase comment t envoyer des fichiers à traiter."}
    ]
  }'