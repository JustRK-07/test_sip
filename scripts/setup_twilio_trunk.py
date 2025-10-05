#!/usr/bin/env python3
"""
Script to automate Twilio SIP trunk creation
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
    validate_twilio_config
)
from utils.logger import setup_logger

logger = setup_logger("setup_twilio")

def create_twilio_trunk(
    trunk_name: str,
    domain_name: str,
    livekit_sip_uri: str,
    username: str,
    password: str,
):
    """
    Create and configure a Twilio SIP trunk

    Args:
        trunk_name: Friendly name for the trunk
        domain_name: Domain name (must end with .pstn.twilio.com)
        livekit_sip_uri: LiveKit SIP endpoint URI
        username: SIP username for authentication
        password: SIP password for authentication
    """
    try:
        validate_twilio_config()
        client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

        # Step 1: Create SIP trunk
        logger.info(f"Creating SIP trunk: {trunk_name}")
        trunk = client.trunking.v1.trunks.create(
            friendly_name=trunk_name,
            domain_name=domain_name,
        )
        logger.info(f"✓ Trunk created - SID: {trunk.sid}")

        # Step 2: Create credential list
        logger.info("Creating credential list")
        credential_list = client.sip.credential_lists.create(
            friendly_name=f"{trunk_name}-credentials"
        )
        logger.info(f"✓ Credential list created - SID: {credential_list.sid}")

        # Step 3: Add credentials
        logger.info("Adding credentials to list")
        credential = client.sip.credential_lists(credential_list.sid).credentials.create(
            username=username,
            password=password,
        )
        logger.info(f"✓ Credentials added - Username: {credential.username}")

        # Step 4: Associate credential list with trunk
        logger.info("Associating credential list with trunk")
        client.trunking.v1.trunks(trunk.sid).credential_lists.create(
            credential_list_sid=credential_list.sid
        )
        logger.info("✓ Credential list associated with trunk")

        # Step 5: Create origination URL (for inbound calls)
        logger.info("Creating origination URL")
        origination_url = client.trunking.v1.trunks(trunk.sid).origination_urls.create(
            friendly_name="LiveKit SIP URI",
            sip_url=livekit_sip_uri,
            priority=1,
            weight=1,
            enabled=True,
        )
        logger.info(f"✓ Origination URL created: {origination_url.sip_url}")

        # Step 6: Associate phone number with trunk (if provided)
        if TWILIO_PHONE_NUMBER:
            logger.info(f"Looking up phone number: {TWILIO_PHONE_NUMBER}")
            phone_numbers = client.incoming_phone_numbers.list(
                phone_number=TWILIO_PHONE_NUMBER
            )

            if phone_numbers:
                phone_sid = phone_numbers[0].sid
                logger.info(f"Associating phone number with trunk")
                client.trunking.v1.trunks(trunk.sid).phone_numbers.create(
                    phone_number_sid=phone_sid
                )
                logger.info(f"✓ Phone number {TWILIO_PHONE_NUMBER} associated with trunk")
            else:
                logger.warning(f"Phone number {TWILIO_PHONE_NUMBER} not found in account")

        logger.info("\n" + "="*60)
        logger.info("Twilio SIP Trunk Setup Complete!")
        logger.info("="*60)
        logger.info(f"Trunk SID: {trunk.sid}")
        logger.info(f"Trunk Domain: {domain_name}")
        logger.info(f"Credential List SID: {credential_list.sid}")
        logger.info(f"Username: {username}")
        logger.info("="*60)

        return {
            "trunk_sid": trunk.sid,
            "domain_name": domain_name,
            "credential_list_sid": credential_list.sid,
            "username": username,
        }

    except Exception as e:
        logger.error(f"Error creating Twilio trunk: {e}")
        raise


if __name__ == "__main__":
    load_dotenv(".env.local")
    load_dotenv(".env")

    # Configuration - Update these values
    TRUNK_NAME = input("Enter trunk name (e.g., 'my-livekit-trunk'): ").strip()
    DOMAIN_NAME = input("Enter domain name (must end with .pstn.twilio.com): ").strip()
    LIVEKIT_SIP_URI = input("Enter LiveKit SIP URI (e.g., sip:sip.livekit.cloud): ").strip()
    SIP_USERNAME = input("Enter SIP username: ").strip()
    SIP_PASSWORD = input("Enter SIP password: ").strip()

    if not DOMAIN_NAME.endswith(".pstn.twilio.com"):
        logger.error("Domain name must end with .pstn.twilio.com")
        sys.exit(1)

    create_twilio_trunk(
        trunk_name=TRUNK_NAME,
        domain_name=DOMAIN_NAME,
        livekit_sip_uri=LIVEKIT_SIP_URI,
        username=SIP_USERNAME,
        password=SIP_PASSWORD,
    )
