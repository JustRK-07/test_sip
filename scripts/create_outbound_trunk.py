#!/usr/bin/env python3
"""
Script to create LiveKit outbound SIP trunk
"""
import os
import sys
import asyncio
from livekit import api

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.livekit_config import (
    LIVEKIT_URL,
    LIVEKIT_API_KEY,
    LIVEKIT_API_SECRET,
    validate_livekit_config
)
from config.twilio_config import (
    TWILIO_SIP_TRUNK_DOMAIN,
    TWILIO_SIP_USERNAME,
    TWILIO_SIP_PASSWORD
)
from utils.logger import setup_logger

logger = setup_logger("create_outbound_trunk")

async def create_outbound_trunk(
    trunk_name: str,
    address: str,
    username: str,
    password: str,
):
    """
    Create a LiveKit outbound SIP trunk

    Args:
        trunk_name: Name for the trunk
        address: Twilio SIP trunk domain
        username: SIP username
        password: SIP password
    """
    try:
        validate_livekit_config()

        livekit_api = api.LiveKitAPI(
            url=LIVEKIT_URL,
            api_key=LIVEKIT_API_KEY,
            api_secret=LIVEKIT_API_SECRET,
        )

        logger.info(f"Creating outbound trunk: {trunk_name}")

        # Create outbound trunk
        trunk = await livekit_api.sip.create_sip_outbound_trunk(
            api.CreateSIPOutboundTrunkRequest(
                trunk=api.SIPOutboundTrunkInfo(
                    name=trunk_name,
                    address=address,
                    auth_username=username,
                    auth_password=password,
                )
            )
        )

        logger.info(f"✓ Outbound trunk created - ID: {trunk.sip_trunk_id}")

        logger.info("\n" + "="*60)
        logger.info("LiveKit Outbound Trunk Setup Complete!")
        logger.info("="*60)
        logger.info(f"Trunk ID: {trunk.sip_trunk_id}")
        logger.info(f"Trunk Name: {trunk_name}")
        logger.info(f"Address: {address}")
        logger.info(f"Username: {username}")
        logger.info("="*60)
        logger.info("\nSave this Trunk ID to your .env file:")
        logger.info(f"LIVEKIT_OUTBOUND_TRUNK_ID={trunk.sip_trunk_id}")
        logger.info("="*60)

        await livekit_api.aclose()

        return {
            "trunk_id": trunk.sip_trunk_id,
        }

    except Exception as e:
        logger.error(f"Error creating outbound trunk: {e}")
        raise


if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv(".env.local")
    load_dotenv(".env")

    # Configuration
    trunk_name = input("Enter outbound trunk name (e.g., 'twilio-outbound'): ").strip()
    address = TWILIO_SIP_TRUNK_DOMAIN or input("Enter Twilio SIP trunk domain: ").strip()
    username = TWILIO_SIP_USERNAME or input("Enter SIP username: ").strip()
    password = TWILIO_SIP_PASSWORD or input("Enter SIP password: ").strip()

    asyncio.run(create_outbound_trunk(
        trunk_name=trunk_name,
        address=address,
        username=username,
        password=password,
    ))
