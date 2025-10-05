import os
from dotenv import load_dotenv

load_dotenv(".env.local")
load_dotenv(".env")

# Twilio Configuration
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER")
TWILIO_SIP_TRUNK_SID = os.getenv("TWILIO_SIP_TRUNK_SID")
TWILIO_SIP_TRUNK_DOMAIN = os.getenv("TWILIO_SIP_TRUNK_DOMAIN")
TWILIO_SIP_USERNAME = os.getenv("TWILIO_SIP_USERNAME")
TWILIO_SIP_PASSWORD = os.getenv("TWILIO_SIP_PASSWORD")

def validate_twilio_config():
    """Validate that all required Twilio configuration is present"""
    if not TWILIO_ACCOUNT_SID:
        raise ValueError("TWILIO_ACCOUNT_SID is not set in environment variables")
    if not TWILIO_AUTH_TOKEN:
        raise ValueError("TWILIO_AUTH_TOKEN is not set in environment variables")
    if not TWILIO_PHONE_NUMBER:
        raise ValueError("TWILIO_PHONE_NUMBER is not set in environment variables")
    return True
