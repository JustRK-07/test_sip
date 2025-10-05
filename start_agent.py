#!/usr/bin/env python3
"""
Simple script to start the AI agent with proper environment loading
"""
import os
from dotenv import load_dotenv

# Load environment before importing anything else
load_dotenv(".env.local")
load_dotenv(".env")

# Set environment variables explicitly
os.environ["LIVEKIT_URL"] = os.getenv("LIVEKIT_URL")
os.environ["LIVEKIT_API_KEY"] = os.getenv("LIVEKIT_API_KEY")
os.environ["LIVEKIT_API_SECRET"] = os.getenv("LIVEKIT_API_SECRET")
os.environ["OPENAI_API_KEY"] = os.getenv("OPENAI_API_KEY")
os.environ["AGENT_NAME"] = os.getenv("AGENT_NAME", "telephony-agent")

print(f"✓ Environment loaded")
print(f"  LiveKit URL: {os.environ['LIVEKIT_URL']}")
print(f"  Agent Name: {os.environ['AGENT_NAME']}")
print(f"\n🚀 Starting AI Voice Agent...")
print(f"   Press Ctrl+C to stop\n")

# Now run the agent
from livekit import agents
from agent.agent import entrypoint

agents.cli.run_app(
    agents.WorkerOptions(
        entrypoint_fnc=entrypoint,
        agent_name=os.environ["AGENT_NAME"],
    )
)
