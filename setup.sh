#!/bin/bash

# Complete setup script

echo "========================================="
echo "AI Voice Agent Setup - LiveKit + Twilio"
echo "========================================="
echo ""

# Step 1: Create virtual environment
echo "Step 1: Creating virtual environment..."
if [ -d "venv" ]; then
    echo "✅ Virtual environment already exists"
else
    python3 -m venv venv
    echo "✅ Virtual environment created"
fi

# Step 2: Activate virtual environment
echo ""
echo "Step 2: Activating virtual environment..."
source venv/bin/activate
echo "✅ Virtual environment activated"

# Step 3: Install dependencies
echo ""
echo "Step 3: Installing dependencies..."
pip install -r requirements.txt
echo "✅ Dependencies installed"

# Step 4: Check for .env.local
echo ""
echo "Step 4: Checking configuration..."
if [ -f ".env.local" ]; then
    echo "✅ .env.local found"
else
    echo "⚠️  .env.local not found"
    echo "Creating from .env.example..."
    cp .env.example .env.local
    echo "✅ .env.local created"
    echo ""
    echo "⚠️  IMPORTANT: Edit .env.local with your actual credentials!"
    echo ""
fi

echo ""
echo "========================================="
echo "Setup Complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Edit .env.local with your Twilio, LiveKit, and OpenAI credentials"
echo "2. Run: python scripts/setup_twilio_trunk.py"
echo "3. Run: python scripts/create_inbound_trunk.py"
echo "4. Run: python scripts/create_outbound_trunk.py"
echo "5. Run: ./run_agent.sh (or python agent/agent.py dev)"
echo ""
echo "See SETUP_GUIDE.md for detailed instructions!"
echo "========================================="
