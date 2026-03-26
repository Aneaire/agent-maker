#!/bin/bash
# Poll all Rodin Gen-2 tasks and download completed GLB files
# Output directory
OUT_DIR="/home/aneaire/Desktop/Projects/HiGantic/public/models"
mkdir -p "$OUT_DIR"

API_KEY="vibecoding"

# Asset name → subscription_key mapping
declare -A ASSETS
ASSETS["core"]="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoxLCJqb2JJZHMiOlsiZDI0YjFmYjctM2FlMy00YzBlLWFkN2QtYWNiNDM3ZDg0ODFkIiwiZWFjMTU4NmQtYmFmZC00YmJhLTg1NTUtOGQ4OGMxMzJmZTg4IiwiNzY3ZTQwZmEtZTc2OC00YmI1LWI5NGEtZGE2ZTcyN2U0NTlhIiwiZjk3ODUzNmMtOGU4OC00ODRiLWFmMjgtMDQzMTE1NzM4MDljIiwiMjljNTY0MzItOGEyYi00OTk3LWIwNGQtYmIxMjk0ZGFmM2Q3IiwiNzJhYmQ0YjItYWI2Yi00MGU4LWIxNzQtMzBhMjc1NjBiNDIyIl0sImlhdCI6MTc3NDQ5NjA5NX0.iBOuSMRNt6ATdN0P0MDAVVyLFVyQJ_yci2ia4dDpysw"
ASSETS["brain-node"]="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoxLCJqb2JJZHMiOlsiZGQ3ZDM2MDAtZTJmMy00MjVhLWE3ZTktOTE1ZDA5M2ZjOTdkIiwiNWE5MjBhY2EtMGZiNS00YjZkLTliZWEtY2EyNGFmNDU0ZWNjIiwiM2ZlYjEwZjMtZTIwZS00NmMxLTk1ZjAtOTdmZjUwYWIzYmYyIiwiNzkwMmRmMjctMzA5Zi00MDA1LWE3MjItNmJiMDhiMmM5NjZlIiwiYmVkZDQyZjUtNDc5NS00MTU4LWIzY2ItMzBkMGNlYjdhODBkIiwiN2M1ZmVhM2EtNGQ0OC00NjE5LTk1YmUtNTViNGQyN2UwNDA5Il0sImlhdCI6MTc3NDQ5NjExNX0.eLIM6ooJI8_Fj-vI74C5w_8AEVx0QIR-SLb0P8hb8y8"
ASSETS["globe-node"]="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoxLCJqb2JJZHMiOlsiOTczMWQxYjctYzUxZi00ZmFlLWE0ODUtMGJjYmE0ZjJhOTQ4IiwiZDllMjliZjEtZjE1Ny00OTA1LWE3NmQtNjk2ZTcwM2ZiYzRmIiwiZDhjNDJjMDAtZGNmYy00MDJiLWI0ZTktMGFkN2QzNTlhMzJiIiwiMDI2MWU0NDgtODU2Ny00NGMzLTkzYjAtNjBkNTM0MzlmMzEyIiwiMjZiMGQ1NTUtY2E4MC00ZDYyLWFiNGQtNzI3YmU4N2ZkMzIyIiwiNmZlNjJhODYtZmU4OS00NzM0LWE5YzYtMjZiOTNmOWY2Y2NhIl0sImlhdCI6MTc3NDQ5NjExOH0.rJy4K9mWsxl-NO28uJOv4c5ahmznlJgqhz2rsA9XLgc"
ASSETS["pages-node"]="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoxLCJqb2JJZHMiOlsiNDQ4M2RjYzYtZTU1Ni00NjExLThhNjYtMWYzZDI4ZjQ2YzhmIiwiOWIwODlhMjAtNmIxNy00YTIxLTgyMDktYTExOWM0NmY5YzdkIiwiNWUwOWYzZDYtNzFjNi00M2JmLTlmNGMtZjNkYzNhMzdlOGM5IiwiY2JjYTVhOTQtZmI3MS00NjExLWJkOTgtOTQzMzdlZTU0ZmRlIiwiM2FhNWE2ZjMtZDFmOC00ZGRiLTk0OWEtNGQwZTNhMWUwZTQxIiwiZDUwMTc3OTAtNmYzOS00YThiLTlhODUtOGU5YTMyZTQyNTJiIl0sImlhdCI6MTc3NDQ5NjEyMX0.RVn54rf_R8OR6KX771eopyyWD9O20amVi2PmETHDcsg"
ASSETS["email-node"]="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoxLCJqb2JJZHMiOlsiZjA3YzI3NTEtNzZlNy00NGNkLTg3NzMtMWZlMDcwYTVhNjJmIiwiMjM5YTllNzUtOWExYS00YjEyLWI5MzQtMTk2MWZhZjMzOTk4IiwiMTc3NjUwYTktZTY3NS00MmQzLTgwZGEtNWZiZTg1MTViMTg0IiwiNDRlZjdkZDAtNWIyNy00YmMzLThlNWYtYzNiY2ZjMDRmNWVkIiwiZjgyMDI4MWEtNTY5ZC00ZTdjLTlmYzktMmUyNmE2MTcwMzQxIiwiZWEzMWMyMWMtNjJkNi00OTM4LTg2MmYtZGZlZmVhODg3OTdmIl0sImlhdCI6MTc3NDQ5NjEzMH0._to5nHCs5pft6KM82qt072n-zPKZO_TNy7CUDCrbsb8"
ASSETS["automation-node"]="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoxLCJqb2JJZHMiOlsiYmVkNTQ4YjEtNGZkNy00ZTE2LTlhYTUtZDI4MjZhZjQ0ZDg4IiwiMDFkYmZjMGEtYjdhZi00MmI3LTk5ZGEtNzJjZGVlOTBkYTNlIiwiNTJhZWFkZWQtMzA2NS00ZjdjLTkzZmUtYjBhZGY5MTYwNDBiIiwiOTEwMGYxMjctNzdiNS00ZTA0LWFiM2ItNjdjMzQyMDkyMjRmIiwiY2EwNmMyMTYtY2Y1ZS00MDRlLThiZGYtOTkwMjQ2OTQxYTk3IiwiMzY3M2VjNjItYTE3Ni00ZjFkLWFhOTktYzZkMWNhMDQ2NGEzIl0sImlhdCI6MTc3NDQ5NjEzM30.euaobqtEZMn895Dfqrnk6oILumzi3AdEyt4yrurdn4w"
ASSETS["api-node"]="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoxLCJqb2JJZHMiOlsiOWYzMTMwNGEtY2Y1Zi00ZTZmLWFiMzUtZTgzYmY1ZTM3NTdiIiwiMWI2ZWQ1NTgtNmEyOS00Y2E1LTg0ZTItMTVhYmQwMDMyYWQ2IiwiMWY3Y2Y2MmUtNjBiZC00NzhmLTkxZDctMGIyY2JiZjUwYTM4IiwiMTYyNzNmZjAtZjQzMy00MTczLWFlNTgtYmM5ZTU1M2Y1YmNmIiwiYTFiMTQ0NGItMDAwNS00ZDRjLTg5MzgtMmI0YWFkYmM5NTA2IiwiYWE0YWQ4ZGItZGZiZC00NWI3LWFlMzMtN2UwNDZkYTk0ZTJkIl0sImlhdCI6MTc3NDQ5NjEzNn0.Thwi13G4JK0ebl3rG5TzAiei14AjOzi5ef9yZULn3yI"
ASSETS["agent-avatar"]="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoxLCJqb2JJZHMiOlsiMjNmMTc5NDctOGIyMC00ZjE0LWI4ZDAtNmU1Y2JjNzk4MGM3IiwiMDVkYTFmMTQtYjRjMS00OGFjLTkyZDItNTMxZGI5ZDdmNzc2IiwiMDhmNTA0YmEtN2E3Yi00ZWUwLTljMTMtYzkyMzhjZmIyNWY2IiwiMWE0MWY0MzYtNTFiNS00ZWViLTg3ZTgtMDkxZjQzZGVkNTY0IiwiNGZlNjZkMjUtZTU0NS00MGRkLThjNzQtNzdjNzczZGYyMTdmIiwiNDIwYWVlYWUtNDUwZC00ZjlkLWJmYWYtMDNmMDg0MzdkNjhkIl0sImlhdCI6MTc3NDQ5NjE0Mn0.klCacgObJQA_6XKjFXejC6aIdAK1A7NKh2Pj3OPlb4k"
ASSETS["workspace"]="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoxLCJqb2JJZHMiOlsiYjkzNzMwZGUtYjRmZi00YmIxLTgwNGUtMmY1YzkyMTg4YmQ2IiwiYTc3YjllMzEtOTY3Ny00MGE4LWJjZDItYWUzNmQ5ZDQ4OGM1IiwiMzhhMDI1ZTctNDFiZS00MGQ0LWFkYWEtMTczOGNiYTE5MGZmIiwiY2JhNjFiZTItMWY5Yi00YjhlLTg4MGYtODlmMjhiZThjYTE2IiwiOGNjNjIwZmMtNjBlNS00YTg2LWE5ZWUtYmU4OGFhM2YwMWE5IiwiOTU5MGMwZmUtZTBiMi00NzI3LWI2NGEtN2QyNjFlNWVkMDhlIl0sImlhdCI6MTc3NDQ5NjE0N30.ptACRR459cGYpF7G3YazkApM9pUzc97ijT9UmGoLyPg"

echo "========================================"
echo "  HiGantic 3D Asset Download Script"
echo "  $(date)"
echo "========================================"
echo ""

COMPLETED=0
TOTAL=${#ASSETS[@]}

for ASSET_NAME in "${!ASSETS[@]}"; do
  SUB_KEY="${ASSETS[$ASSET_NAME]}"
  echo "--- [$ASSET_NAME] ---"

  # Poll until done (max 60 attempts = 10 minutes)
  for i in $(seq 1 60); do
    RESULT=$(curl -s -X POST "https://api.hyper3d.com/api/v2/status" \
      -H "Authorization: Bearer $API_KEY" \
      -H "Content-Type: application/json" \
      -d "{\"subscription_key\": \"$SUB_KEY\"}")

    STATUS=$(echo "$RESULT" | python3 -c "import sys,json; data=json.load(sys.stdin); print(data.get('status','unknown'))" 2>/dev/null || echo "unknown")

    if [ "$STATUS" = "Done" ] || [ "$STATUS" = "done" ] || [ "$STATUS" = "Completed" ]; then
      echo "  ✅ Generation complete! Downloading..."

      # Get download links
      TASK_UUID=$(echo "$RESULT" | python3 -c "import sys,json; data=json.load(sys.stdin); print(data.get('uuid', data.get('jobs',[{}])[0].get('uuid','')))" 2>/dev/null)

      DOWNLOAD_RESULT=$(curl -s -X POST "https://api.hyper3d.com/api/v2/download" \
        -H "Authorization: Bearer $API_KEY" \
        -H "Content-Type: application/json" \
        -d "{\"task_uuid\": \"$TASK_UUID\"}")

      # Try to get GLB URL
      GLB_URL=$(echo "$DOWNLOAD_RESULT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
items = data if isinstance(data, list) else data.get('list', data.get('items', data.get('downloads', [])))
if isinstance(items, list):
    for item in items:
        url = item.get('url', item.get('download_url', ''))
        if '.glb' in url.lower() or 'glb' in item.get('format','').lower() or 'glb' in item.get('name','').lower():
            print(url)
            break
    else:
        # If no GLB found, print first URL
        if items:
            print(items[0].get('url', items[0].get('download_url', '')))
" 2>/dev/null)

      if [ -n "$GLB_URL" ] && [ "$GLB_URL" != "" ]; then
        curl -sL "$GLB_URL" -o "$OUT_DIR/${ASSET_NAME}.glb"
        FILE_SIZE=$(stat --printf="%s" "$OUT_DIR/${ASSET_NAME}.glb" 2>/dev/null || echo "0")
        echo "  📦 Saved: $OUT_DIR/${ASSET_NAME}.glb ($FILE_SIZE bytes)"
        COMPLETED=$((COMPLETED + 1))
      else
        echo "  ⚠️  Could not find GLB download URL"
        echo "  Raw download response: $DOWNLOAD_RESULT" | head -c 500
      fi
      break
    elif [ "$STATUS" = "Failed" ] || [ "$STATUS" = "failed" ]; then
      echo "  ❌ Generation FAILED"
      echo "  $RESULT" | head -c 300
      break
    else
      if [ $((i % 6)) -eq 0 ]; then
        echo "  ⏳ Still generating... ($STATUS) [${i}0s elapsed]"
      fi
    fi
    sleep 10
  done
  echo ""
done

echo "========================================"
echo "  Done! $COMPLETED / $TOTAL assets downloaded"
echo "  Output: $OUT_DIR/"
echo "========================================"
ls -la "$OUT_DIR/"*.glb 2>/dev/null
