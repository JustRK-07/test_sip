#!/usr/bin/env python3
"""
Script to get Twilio account information
"""
import os
import sys
from twilio.rest import Client
from dotenv import load_dotenv

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.twilio_config import TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
from utils.logger import setup_logger

logger = setup_logger("twilio_info")

def get_twilio_info():
    """Get Twilio account information including phone numbers and SIP trunks"""
    try:
        client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

        # Get phone numbers
        logger.info("Fetching phone numbers...")
        phone_numbers = client.incoming_phone_numbers.list(limit=20)

        if phone_numbers:
            logger.info("\n" + "="*60)
            logger.info("TWILIO PHONE NUMBERS")
            logger.info("="*60)
            for number in phone_numbers:
                logger.info(f"Phone Number: {number.phone_number}")
                logger.info(f"  - SID: {number.sid}")
                logger.info(f"  - Friendly Name: {number.friendly_name}")
                logger.info(f"  - Capabilities: Voice={number.capabilities['voice']}, SMS={number.capabilities['sms']}")
                logger.info("-" * 60)
        else:
            logger.warning("No phone numbers found in account")

        # Get SIP trunks
        logger.info("\nFetching SIP trunks...")
        trunks = client.trunking.v1.trunks.list(limit=20)

        if trunks:
            logger.info("\n" + "="*60)
            logger.info("TWILIO SIP TRUNKS")
            logger.info("="*60)
            for trunk in trunks:
                logger.info(f"Trunk: {trunk.friendly_name}")
                logger.info(f"  - SID: {trunk.sid}")
                logger.info(f"  - Domain: {trunk.domain_name}")

                # Get associated phone numbers
                trunk_numbers = client.trunking.v1.trunks(trunk.sid).phone_numbers.list()
                if trunk_numbers:
                    logger.info(f"  - Associated Numbers:")
                    for tn in trunk_numbers:
                        logger.info(f"    * {tn.phone_number}")

                # Get credential lists
                try:
                    cred_lists = client.trunking.v1.trunks(trunk.sid).credentials_lists.list()
                    if cred_lists:
                        logger.info(f"  - Credential Lists:")
                        for cl in cred_lists:
                            logger.info(f"    * {cl.friendly_name} (SID: {cl.sid})")
                except Exception as e:
                    logger.debug(f"Could not fetch credential lists: {e}")

                # Get origination URLs
                orig_urls = client.trunking.v1.trunks(trunk.sid).origination_urls.list()
                if orig_urls:
                    logger.info(f"  - Origination URLs:")
                    for url in orig_urls:
                        logger.info(f"    * {url.sip_url} (Enabled: {url.enabled})")

                logger.info("-" * 60)
        else:
            logger.warning("No SIP trunks found in account")

        logger.info("\n" + "="*60)
        logger.info("RECOMMENDED NEXT STEPS")
        logger.info("="*60)

        if not phone_numbers:
            logger.info("1. Purchase a phone number from Twilio Console")
            logger.info("   https://console.twilio.com/us1/develop/phone-numbers/manage/search")

        if not trunks:
            logger.info("2. Create a SIP trunk:")
            logger.info("   python scripts/setup_twilio_trunk.py")
        else:
            logger.info("2. Your SIP trunk is already created!")
            logger.info("   Use the domain and credentials to set up LiveKit trunks")

        logger.info("\n3. Create LiveKit inbound trunk:")
        logger.info("   python scripts/create_inbound_trunk.py")
        logger.info("\n4. Create LiveKit outbound trunk:")
        logger.info("   python scripts/create_outbound_trunk.py")
        logger.info("="*60)

    except Exception as e:
        logger.error(f"Error fetching Twilio info: {e}")
        raise


if __name__ == "__main__":
    load_dotenv(".env.local")
    load_dotenv(".env")

    if not TWILIO_ACCOUNT_SID or not TWILIO_AUTH_TOKEN:
        print("Error: TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set in .env.local")
        sys.exit(1)

    get_twilio_info()
