#!/bin/bash

# Quick test script to verify user isolation
# Usage: ./test-quick.sh

echo "🧪 Quick User Isolation Test"
echo "=============================="
echo ""
echo "Running automated tests..."
echo ""

node test-user-isolation.js

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Automated tests completed successfully!"
    echo ""
    echo "📱 Manual Testing:"
    echo "=================="
    echo ""
    echo "Frontend is running at: http://localhost:5174/"
    echo ""
    echo "Try logging in with these accounts:"
    echo "  1. alice@test.com / test123456"
    echo "  2. bob@test.com / test123456"
    echo "  3. charlie@test.com / test123456"
    echo ""
    echo "Each user should see exactly 3 unique packages."
    echo ""
else
    echo ""
    echo "❌ Tests failed. Check the output above for errors."
    exit 1
fi
