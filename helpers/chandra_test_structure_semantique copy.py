import requests
import time
import json

API_URL = "https://www.datalab.to/api/v1"
HEADERS = {"X-Api-Key": "YOUR_API_KEY"}

#
# Schema and file configuration
#
schema_json = """{
  "type": "object",
  "title": "ExtractionSchema",
  "description": "Schema for structured data extraction",
  "properties": {
    "events": {
      "type": "array",
      "description": "évènements d'une journée",
      "items": {
        "type": "object",
        "properties": {
          "numéro de page": {
            "type": "number",
            "description": "récupéré entre deux tirets en haut à droite"
          },
          "année": {
            "type": "number",
            "description": "année centrée"
          },
          "mois": {
            "type": "string",
            "description": "nom du mois"
          },
          "numéro du jour": {
            "type": "number",
            "description": "numéro du jour"
          },
          "libellé du jour": {
            "type": "string",
            "description": "jour (lundi, mardi etc..)"
          },
          "content": {
            "type": "string",
            "description": "string intacte correspondant aux evenements du jour"
          }
        },
        "required": [
          "numéro de page",
          "année",
          "mois",
          "numéro du jour",
          "libellé du jour",
          "content"
        ]
      }
    }
  },
  "required": [
    "events"
  ]
}"""
pdf_path = "document.pdf"

#
# Load file and submit extraction request. You can also pass in file_url.
#
with open(pdf_path, "rb") as f:
    files = {
        'file': ('document.pdf', f, 'application/pdf'),
        'page_schema': (None, schema_json),
    }

    response = requests.post(f"{API_URL}/extract", files=files, headers=HEADERS)

    if response.status_code != 200:
        print(f"Error submitting job: {response.status_code}")
        print(response.text)
        exit(1)

    data = response.json()
    check_url = data["request_check_url"]
    print(f"Job submitted successfully. Polling URL: {check_url}")


def poll_until_complete(check_url):
    """Poll a request_check_url until the job completes or fails."""
    max_polls = 300
    for i in range(max_polls):
        time.sleep(2)
        poll_response = requests.get(check_url, headers=HEADERS)

        if poll_response.status_code != 200:
            print(f"Error polling status: {poll_response.status_code}")
            return None

        poll_data = poll_response.json()
        status = poll_data.get("status")
        print(f"Poll {i+1}: Status = {status}")

        if status == "failed":
            print(f"\nFailed: {poll_data.get('error', 'Unknown error')}")
            return None

        if status == "complete":
            return poll_data

    print("\nTimeout reached after 300 polls.")
    return None


#
# Wait for extraction to complete
#
result = poll_until_complete(check_url)
if result:
    #
    # Your extracted results are in extraction_schema_json.
    # The raw parsed document with detected blocks are in json.
    # Your extraction_schema_json contains citations to block IDs in the json field.
    #
    extraction_result = json.loads(result.get('extraction_schema_json', '{}'))
    print("\nExtracted data:")
    print(json.dumps(extraction_result, indent=2))

    #
    # Fast mode only: confidence scores are computed asynchronously in the
    # background and appear as extraction_score_average and per-field _score
    # keys on later polls of the same URL. (Balanced mode returns inline
    # per-field verification instead; turbo returns values only.)
    #
    for i in range(30):
        time.sleep(2)
        score_response = requests.get(check_url, headers=HEADERS).json()
        score_avg = score_response.get("extraction_score_average")
        if score_avg is not None:
            print(f"\nExtraction score average: {score_avg}")
            break