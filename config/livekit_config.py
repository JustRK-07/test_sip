import os
from dotenv import load_dotenv

load_dotenv(".env.local")
load_dotenv(".env")

# LiveKit Configuration
LIVEKIT_URL = os.getenv("LIVEKIT_URL")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")

# Agent Configuration
AGENT_NAME = os.getenv("AGENT_NAME", "telephony-agent")

def validate_livekit_config():
    """Validate that all required LiveKit configuration is present"""
    if not LIVEKIT_URL:
        raise ValueError("LIVEKIT_URL is not set in environment variables")
    if not LIVEKIT_API_KEY:
        raise ValueError("LIVEKIT_API_KEY is not set in environment variables")
    if not LIVEKIT_API_SECRET:
        raise ValueError("LIVEKIT_API_SECRET is not set in environment variables")
    return True
