#!/bin/bash

echo "🧪 Testing Drive Folder Link with curl..."

# You need to replace this token with the actual token from your browser
# To get it: open browser dev tools on localhost:3000 and run: localStorage.getItem('authToken')
TOKEN="YOUR_TOKEN_HERE"

if [ "$TOKEN" = "YOUR_TOKEN_HERE" ]; then
    echo "❌ Please update the TOKEN variable in this script with your actual auth token"
    echo "   1. Open browser dev tools on http://localhost:3000"
    echo "   2. Run: localStorage.getItem('authToken')"
    echo "   3. Copy the token and replace TOKEN in this script"
    exit 1
fi

echo "📤 Sending PUT request..."

curl -X PUT http://localhost:3000/api/opportunities/453c5db8-3bb0-415c-beef-aadb3b760436/drive-folder \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"folderId": "0BwLYHtwPeCSpX0ZYU1EwTUhsOEk"}' \
  -v

echo -e "\n\n🔍 If you see a 400 error above, the issue is with the HTTP request format or authentication."
echo "If you see success, the issue might be specific to the browser/JavaScript environment."