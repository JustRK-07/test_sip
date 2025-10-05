#!/usr/bin/env python3
"""
Script to test outbound calling
"""
import os
import sys
import asyncio
import argparse

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.dispatch_service import DispatchService
from services.sip_manager import SIPManager
from utils.logger import setup_logger
from dotenv import load_dotenv

load_dotenv(".env.local")
load_dotenv(".env")

logger = setup_logger("test_call")

async def make_test_call(phone_number: str, trunk_id: str = None):
    """
    Make a test outbound call

    Args:
        phone_number: Phone number to call
        trunk_id: Optional SIP trunk ID (will use from env if not provided)
    """
    dispatch_service = DispatchService()
    sip_manager = SIPManager()

    try:
        # Step 1: Dispatch the agent
        logger.info("Step 1: Dispatching agent...")
        dispatch_info = await dispatch_service.dispatch_outbound_call(
            phone_number=phone_number
        )

        logger.info(f"✓ Agent dispatched to room: {dispatch_info['room_name']}")

        # Wait a moment for agent to connect
        logger.info("Waiting for agent to connect...")
        await asyncio.sleep(5)

        # Step 2: Create SIP participant (make the call)
        if not trunk_id:
            trunk_id = os.getenv("LIVEKIT_OUTBOUND_TRUNK_ID")
            if not trunk_id:
                raise ValueError("No trunk_id provided and LIVEKIT_OUTBOUND_TRUNK_ID not set in .env")

        logger.info("Step 2: Creating outbound call...")
        participant = await sip_manager.create_outbound_call(
            phone_number=phone_number,
            room_name=dispatch_info['room_name'],
            trunk_id=trunk_id,
        )

        logger.info(f"✓ Call initiated to {phone_number}")
        logger.info(f"Participant ID: {participant.participant_identity}")

        logger.info("\n" + "="*60)
        logger.info("Test Call Initiated Successfully!")
        logger.info("="*60)
        logger.info(f"Phone Number: {phone_number}")
        logger.info(f"Room: {dispatch_info['room_name']}")
        logger.info(f"Dispatch ID: {dispatch_info['dispatch_id']}")
        logger.info("="*60)
        logger.info("\nThe agent should now be calling the number.")
        logger.info("Answer the phone to test the conversation!")
        logger.info("="*60)

    except Exception as e:
        logger.error(f"Error making test call: {e}")
        raise

    finally:
        dispatch_service.close()
        sip_manager.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test outbound calling")
    parser.add_argument("--phone", required=True, help="Phone number to call (E.164 format)")
    parser.add_argument("--trunk-id", help="SIP trunk ID (optional, uses .env if not provided)")

    args = parser.parse_args()

    asyncio.run(make_test_call(
        phone_number=args.phone,
        trunk_id=args.trunk_id,
    ))
