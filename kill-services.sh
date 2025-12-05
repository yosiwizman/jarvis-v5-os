#!/bin/bash

# Kill all Jarvis services running on ports 1234, 3000, and 3001
# Run: ./kill-services.sh

echo "🛑 Stopping Jarvis services..."
echo ""

# Find and kill processes on the required ports
PIDS=$(lsof -ti:1234 -ti:3000 -ti:3001 2>/dev/null)

if [ -z "$PIDS" ]; then
    echo "✓ No services running on ports 1234, 3000, or 3001"
else
    echo "Found processes: $PIDS"
    echo "Killing..."
    echo "$PIDS" | xargs kill -9 2>/dev/null
    sleep 1
    echo "✓ All services stopped"
fi

echo ""
echo "You can now restart with: npm start"


