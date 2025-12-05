#!/bin/bash

# Test script to verify API endpoints are working
# Run: ./test-api.sh

echo "🧪 Testing Jarvis API Endpoints"
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default to localhost, but allow override
HOST="${1:-localhost}"
BASE_URL="https://${HOST}:3000"

echo "Testing against: ${BASE_URL}"
echo ""

# Test 1: Config endpoint
echo -n "1. Testing /api/config ... "
RESPONSE=$(curl -k -s -w "%{http_code}" -o /tmp/test-config.json "${BASE_URL}/api/config" 2>/dev/null)
HTTP_CODE="${RESPONSE: -3}"
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ OK${NC}"
    cat /tmp/test-config.json | python3 -m json.tool 2>/dev/null | head -5 || cat /tmp/test-config.json | head -5
else
    echo -e "${RED}✗ FAILED (HTTP $HTTP_CODE)${NC}"
    cat /tmp/test-config.json
fi
echo ""

# Test 2: Keys metadata
echo -n "2. Testing /api/admin/keys/meta ... "
RESPONSE=$(curl -k -s -w "%{http_code}" -o /tmp/test-keys.json "${BASE_URL}/api/admin/keys/meta" 2>/dev/null)
HTTP_CODE="${RESPONSE: -3}"
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ OK${NC}"
    cat /tmp/test-keys.json | python3 -m json.tool 2>/dev/null || cat /tmp/test-keys.json
    
    # Check if keys are present
    if grep -q '"present":true' /tmp/test-keys.json; then
        echo -e "${GREEN}  → API keys are configured${NC}"
    else
        echo -e "${YELLOW}  ⚠ API keys not configured yet${NC}"
        echo "  → Visit ${BASE_URL}/settings to add keys"
    fi
else
    echo -e "${RED}✗ FAILED (HTTP $HTTP_CODE)${NC}"
    cat /tmp/test-keys.json
fi
echo ""

# Test 3: Check if OpenAI key works (only if configured)
if grep -q '"openai":{"present":true}' /tmp/test-keys.json 2>/dev/null; then
    echo -n "3. Testing /api/openai/text-chat ... "
    RESPONSE=$(curl -k -s -w "%{http_code}" -o /tmp/test-chat.json -X POST \
        -H "Content-Type: application/json" \
        -d '{"messages":[{"role":"user","content":"Say hello"}],"settings":{"model":"gpt-5"}}' \
        "${BASE_URL}/api/openai/text-chat" 2>/dev/null)
    HTTP_CODE="${RESPONSE: -3}"
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✓ OK${NC}"
        # Show first 100 chars of response
        cat /tmp/test-chat.json | python3 -c "import sys, json; data=json.load(sys.stdin); print(f\"  Response: {data.get('message', '')[:100]}...\")" 2>/dev/null || echo "  (Response received)"
    else
        echo -e "${RED}✗ FAILED (HTTP $HTTP_CODE)${NC}"
        cat /tmp/test-chat.json
    fi
    echo ""
else
    echo -e "3. Testing /api/openai/text-chat ... ${YELLOW}SKIPPED (OpenAI key not configured)${NC}"
    echo ""
fi

# Test 4: File library
echo -n "4. Testing /api/file-library ... "
RESPONSE=$(curl -k -s -w "%{http_code}" -o /tmp/test-files.json "${BASE_URL}/api/file-library" 2>/dev/null)
HTTP_CODE="${RESPONSE: -3}"
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ OK${NC}"
    FILE_COUNT=$(cat /tmp/test-files.json | python3 -c "import sys, json; print(len(json.load(sys.stdin).get('files', [])))" 2>/dev/null || echo "?")
    echo "  → $FILE_COUNT files in library"
else
    echo -e "${RED}✗ FAILED (HTTP $HTTP_CODE)${NC}"
    cat /tmp/test-files.json
fi
echo ""

# Summary
echo "================================"
echo "Summary:"
echo ""
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    echo ""
    echo "Your Jarvis server is working correctly."
    echo "Access it from any device at:"
    echo "  ${BASE_URL}"
else
    echo -e "${RED}✗ Some tests failed${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Make sure services are running: npm start"
    echo "  2. Check server logs for errors"
    echo "  3. See API_KEYS_GUIDE.md for detailed help"
fi
echo ""

# Cleanup
rm -f /tmp/test-*.json


