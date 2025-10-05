#!/usr/bin/env python3
"""
Script to create LiveKit inbound SIP trunk
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
    AGENT_NAME,
    validate_livekit_config
)
from config.twilio_config import TWILIO_SIP_USERNAME, TWILIO_SIP_PASSWORD
from utils.logger import setup_logger

logger = setup_logger("create_inbound_trunk")

async def create_inbound_trunk(
    trunk_name: str,
    username: str,
    password: str,
    allowed_numbers: list = None,
):
    """
    Create a LiveKit inbound SIP trunk

    Args:
        trunk_name: Name for the trunk
        username: SIP username (from Twilio)
        password: SIP password (from Twilio)
        allowed_numbers: Optional list of allowed phone numbers
    """
    try:
        validate_livekit_config()

        livekit_api = api.LiveKitAPI(
            url=LIVEKIT_URL,
            api_key=LIVEKIT_API_KEY,
            api_secret=LIVEKIT_API_SECRET,
        )

        logger.info(f"Creating inbound trunk: {trunk_name}")

        # Create inbound trunk
        trunk = await livekit_api.sip.create_sip_inbound_trunk(
            api.CreateSIPInboundTrunkRequest(
                trunk=api.SIPInboundTrunkInfo(
                    name=trunk_name,
                    numbers=allowed_numbers or [],
                    allowed_addresses=[],  # Allow from any IP (can restrict to Twilio IPs)
                    auth_username=username,
                    auth_password=password,
                )
            )
        )

        logger.info(f"✓ Inbound trunk created - ID: {trunk.sip_trunk_id}")

        # Create dispatch rule
        logger.info("Creating dispatch rule for inbound calls")
        dispatch_rule = await livekit_api.sip.create_sip_dispatch_rule(
            api.CreateSIPDispatchRuleRequest(
                rule=api.SIPDispatchRuleInfo(
                    trunk_ids=[trunk.sip_trunk_id],
                    name=f"{trunk_name}-dispatch",
                    # Create a new room for each call
                    room_name="",  # Empty string creates new room
                    # Pin to specific region if needed
                    # metadata='{"region": "us-west"}',
                )
            )
        )

        logger.info(f"✓ Dispatch rule created - ID: {dispatch_rule.sip_dispatch_rule_id}")

        logger.info("\n" + "="*60)
        logger.info("LiveKit Inbound Trunk Setup Complete!")
        logger.info("="*60)
        logger.info(f"Trunk ID: {trunk.sip_trunk_id}")
        logger.info(f"Trunk Name: {trunk_name}")
        logger.info(f"Dispatch Rule ID: {dispatch_rule.sip_dispatch_rule_id}")
        logger.info(f"Agent Name: {AGENT_NAME}")
        logger.info("="*60)

        await livekit_api.aclose()

        return {
            "trunk_id": trunk.sip_trunk_id,
            "dispatch_rule_id": dispatch_rule.sip_dispatch_rule_id,
        }

    except Exception as e:
        logger.error(f"Error creating inbound trunk: {e}")
        raise


if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv(".env.local")
    load_dotenv(".env")

    # Configuration
    trunk_name = input("Enter inbound trunk name (e.g., 'twilio-inbound'): ").strip()
    username = TWILIO_SIP_USERNAME or input("Enter SIP username: ").strip()
    password = TWILIO_SIP_PASSWORD or input("Enter SIP password: ").strip()

    asyncio.run(create_inbound_trunk(
        trunk_name=trunk_name,
        username=username,
        password=password,
    ))
