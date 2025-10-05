#!/usr/bin/env python3
"""
Script to update existing Twilio SIP trunk with LiveKit configuration
"""
import os
import sys
from twilio.rest import Client
from dotenv import load_dotenv

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.twilio_config import (
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER,
    TWILIO_SIP_TRUNK_SID,
    TWILIO_SIP_USERNAME,
    TWILIO_SIP_PASSWORD,
    validate_twilio_config
)
from utils.logger import setup_logger

logger = setup_logger("update_twilio")

def update_twilio_trunk(livekit_sip_uri: str):
    """
    Update existing Twilio SIP trunk with LiveKit configuration

    Args:
        livekit_sip_uri: LiveKit SIP endpoint URI
    """
    try:
        validate_twilio_config()
        client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

        trunk_sid = TWILIO_SIP_TRUNK_SID

        logger.info(f"Updating Twilio trunk: {trunk_sid}")

        # Step 1: Create or get credential list
        logger.info("Setting up credential list...")

        # Check if credential list already exists
        existing_cred_lists = client.sip.credential_lists.list()
        livekit_cred_list = None

        for cl in existing_cred_lists:
            if "livekit" in cl.friendly_name.lower():
                livekit_cred_list = cl
                logger.info(f"Found existing credential list: {cl.friendly_name}")
                break

        if not livekit_cred_list:
            logger.info("Creating new credential list...")
            livekit_cred_list = client.sip.credential_lists.create(
                friendly_name="LiveKit SIP Credentials"
            )
            logger.info(f"✓ Credential list created - SID: {livekit_cred_list.sid}")

        # Step 2: Add or update credentials
        logger.info("Adding credentials to list...")

        # Check if credentials already exist
        existing_creds = client.sip.credential_lists(livekit_cred_list.sid).credentials.list()
        cred_exists = any(c.username == TWILIO_SIP_USERNAME for c in existing_creds)

        if not cred_exists:
            credential = client.sip.credential_lists(livekit_cred_list.sid).credentials.create(
                username=TWILIO_SIP_USERNAME,
                password=TWILIO_SIP_PASSWORD,
            )
            logger.info(f"✓ Credentials added - Username: {credential.username}")
        else:
            logger.info(f"✓ Credentials already exist - Username: {TWILIO_SIP_USERNAME}")

        # Step 3: Associate credential list with trunk
        logger.info("Associating credential list with trunk...")

        try:
            trunk_cred_lists = client.trunking.v1.trunks(trunk_sid).credentials_lists.list()
            cred_list_associated = any(cl.sid == livekit_cred_list.sid for cl in trunk_cred_lists)

            if not cred_list_associated:
                client.trunking.v1.trunks(trunk_sid).credentials_lists.create(
                    credential_list_sid=livekit_cred_list.sid
                )
                logger.info("✓ Credential list associated with trunk")
            else:
                logger.info("✓ Credential list already associated with trunk")
        except Exception as e:
            logger.warning(f"Could not verify credential list association: {e}")

        # Step 4: Add origination URL (for inbound calls)
        logger.info("Setting up origination URL...")

        existing_urls = client.trunking.v1.trunks(trunk_sid).origination_urls.list()
        livekit_url_exists = any(livekit_sip_uri in url.sip_url for url in existing_urls)

        if not livekit_url_exists:
            origination_url = client.trunking.v1.trunks(trunk_sid).origination_urls.create(
                friendly_name="LiveKit SIP URI",
                sip_url=livekit_sip_uri,
                priority=1,
                weight=1,
                enabled=True,
            )
            logger.info(f"✓ Origination URL created: {origination_url.sip_url}")
        else:
            logger.info(f"✓ Origination URL already exists: {livekit_sip_uri}")

        # Step 5: Associate phone number with trunk (if not already associated)
        if TWILIO_PHONE_NUMBER:
            logger.info(f"Associating phone number {TWILIO_PHONE_NUMBER} with trunk...")

            trunk_numbers = client.trunking.v1.trunks(trunk_sid).phone_numbers.list()
            number_associated = any(tn.phone_number == TWILIO_PHONE_NUMBER for tn in trunk_numbers)

            if not number_associated:
                phone_numbers = client.incoming_phone_numbers.list(
                    phone_number=TWILIO_PHONE_NUMBER
                )

                if phone_numbers:
                    phone_sid = phone_numbers[0].sid
                    client.trunking.v1.trunks(trunk_sid).phone_numbers.create(
                        phone_number_sid=phone_sid
                    )
                    logger.info(f"✓ Phone number {TWILIO_PHONE_NUMBER} associated with trunk")
                else:
                    logger.warning(f"Phone number {TWILIO_PHONE_NUMBER} not found in account")
            else:
                logger.info(f"✓ Phone number already associated: {TWILIO_PHONE_NUMBER}")

        logger.info("\n" + "="*60)
        logger.info("Twilio SIP Trunk Update Complete!")
        logger.info("="*60)
        logger.info(f"Trunk SID: {trunk_sid}")
        logger.info(f"Credential List SID: {livekit_cred_list.sid}")
        logger.info(f"Username: {TWILIO_SIP_USERNAME}")
        logger.info(f"LiveKit SIP URI: {livekit_sip_uri}")
        if TWILIO_PHONE_NUMBER:
            logger.info(f"Associated Number: {TWILIO_PHONE_NUMBER}")
        logger.info("="*60)
        logger.info("\nNext steps:")
        logger.info("1. Create LiveKit inbound trunk: python scripts/create_inbound_trunk.py")
        logger.info("2. Create LiveKit outbound trunk: python scripts/create_outbound_trunk.py")
        logger.info("="*60)

    except Exception as e:
        logger.error(f"Error updating Twilio trunk: {e}")
        raise


if __name__ == "__main__":
    load_dotenv(".env.local")
    load_dotenv(".env")

    if not TWILIO_SIP_USERNAME or TWILIO_SIP_USERNAME == "livekit_user":
        print("\n⚠️  WARNING: Please set a custom TWILIO_SIP_USERNAME in .env.local")
        print("Current value: livekit_user (default)")
        username = input("Enter SIP username (or press Enter to use 'livekit_user'): ").strip()
        if username:
            # Update .env.local
            print("Please update TWILIO_SIP_USERNAME in .env.local manually")

    if not TWILIO_SIP_PASSWORD or TWILIO_SIP_PASSWORD == "your_secure_password_here":
        print("\n⚠️  REQUIRED: Please set TWILIO_SIP_PASSWORD in .env.local")
        print("This should be a strong password for SIP authentication")
        sys.exit(1)

    # LiveKit SIP endpoint (you can change the region if needed)
    print("\nLiveKit SIP Endpoint Options:")
    print("1. Global: sip:sip.livekit.cloud")
    print("2. US West: sip:sip-us-west.livekit.cloud")
    print("3. US East: sip:sip-us-east.livekit.cloud")
    print("4. EU: sip:sip-eu.livekit.cloud")
    print("5. Custom")

    choice = input("\nSelect endpoint (1-5) [default: 1]: ").strip() or "1"

    endpoints = {
        "1": "sip:sip.livekit.cloud",
        "2": "sip:sip-us-west.livekit.cloud",
        "3": "sip:sip-us-east.livekit.cloud",
        "4": "sip:sip-eu.livekit.cloud",
    }

    if choice in endpoints:
        livekit_sip_uri = endpoints[choice]
    else:
        livekit_sip_uri = input("Enter custom LiveKit SIP URI: ").strip()

    update_twilio_trunk(livekit_sip_uri=livekit_sip_uri)
