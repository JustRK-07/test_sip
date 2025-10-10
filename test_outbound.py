#!/usr/bin/env python3
"""
Quick outbound call test
"""
import asyncio
import os
from dotenv import load_dotenv
from livekit import api

load_dotenv(".env.local")

async def make_call(phone_number: str):
    """Make an outbound call"""

    print(f"📞 Making outbound call to {phone_number}...")

    lk = api.LiveKitAPI(
        url=os.getenv('LIVEKIT_URL'),
        api_key=os.getenv('LIVEKIT_API_KEY'),
        api_secret=os.getenv('LIVEKIT_API_SECRET'),
    )

    # Step 1: Dispatch the agent
    print("Step 1: Dispatching agent...")
    import json
    import uuid

    room_name = f"outbound-call-{uuid.uuid4().hex[:8]}"
    metadata = json.dumps({"phone_number": phone_number})

    dispatch = await lk.agent_dispatch.create_dispatch(
        api.CreateAgentDispatchRequest(
            agent_name="telephony-agent",
            room=room_name,
            metadata=metadata,
        )
    )

    print(f"✓ Agent dispatched to room: {room_name}")
    print(f"  Dispatch ID: {dispatch.id}")

    # Wait for agent to connect
    print("Waiting 5 seconds for agent to connect...")
    await asyncio.sleep(5)

    # Step 2: Create SIP participant (make the call)
    print("Step 2: Initiating call...")

    trunk_id = os.getenv('LIVEKIT_OUTBOUND_TRUNK_ID')
    print(f"  Using trunk: {trunk_id}")

    participant = await lk.sip.create_sip_participant(
        api.CreateSIPParticipantRequest(
            sip_trunk_id=trunk_id,
            sip_call_to=phone_number,
            room_name=room_name,
            participant_identity=f"caller-{phone_number}",
            participant_name=phone_number,
        )
    )

    print(f"\n{'='*60}")
    print(f"✅ CALL INITIATED SUCCESSFULLY!")
    print(f"{'='*60}")
    print(f"Phone Number: {phone_number}")
    print(f"Room: {room_name}")
    print(f"Participant ID: {participant.participant_identity}")
    print(f"{'='*60}")
    print(f"\n📱 Your phone should ring shortly!")
    print(f"Answer to talk with the AI agent.")
    print(f"{'='*60}")

    await lk.aclose()

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("\n❌ Error: Phone number is required")
        print("\nUsage:")
        print(f"  python {sys.argv[0]} <phone_number>")
        print("\nExample:")
        print(f"  python {sys.argv[0]} +14155551234")
        print(f"  python {sys.argv[0]} +919529117230")
        sys.exit(1)

    phone = sys.argv[1]
    asyncio.run(make_call(phone))
