export $(grep -v '^#' /Users/iremus/Dev/sherlook/.env | xargs)

#curl -sS "https://albert.api.etalab.gouv.fr/v1/collections/237718" \
#  -H "Authorization: Bearer $ALBERT_API_KEY" \
#  -H "Content-Type: application/json"


curl -sS "https://albert.api.etalab.gouv.fr/v1/chat/completions" \
  -H "Authorization: Bearer $ALBERT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "mistralai/Mistral-Small-3.2-24B-Instruct-2506",
    "messages": [
      {
        "role": "system",
        "content": "Tu réponds juste à la question."
      },
      {
        "role": "user",
        "content": "Quel est le nombre d élement de la collection que je t ai fournie ?"
      }
    ],
    "tools": [
      {
        "type": "search",
        "collection_ids": ["237718"],
        "method": "hybrid",
        "limit": 1
      }
    ],
    "tool_choice": "auto"
  }'