#!/bin/bash

# Quick start script to run the AI voice agent

echo "=================================="
echo "AI Voice Agent - LiveKit + Twilio"
echo "=================================="
echo ""

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found!"
    echo "Please run: python -m venv venv"
    exit 1
fi

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "❌ .env.local not found!"
    echo "Please copy .env.example to .env.local and configure it"
    exit 1
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Check if dependencies are installed
if ! python -c "import livekit" 2>/dev/null; then
    echo "❌ Dependencies not installed!"
    echo "Please run: pip install -r requirements.txt"
    exit 1
fi

echo "✅ Environment ready"
echo ""
echo "Starting AI Voice Agent..."
echo "Press Ctrl+C to stop"
echo ""

# Run the agent
python agent/agent.py dev
