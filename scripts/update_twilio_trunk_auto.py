#!/usr/bin/env python3
"""
Automated script to update Twilio SIP trunk (no user input required)
"""
import os
import sys
from twilio.rest import Client
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.twilio_config import *
from utils.logger import setup_logger

logger = setup_logger("update_twilio")

load_dotenv(".env.local")
load_dotenv(".env")

# Use global LiveKit SIP endpoint
LIVEKIT_SIP_URI = "sip:sip.livekit.cloud"

try:
    client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    trunk_sid = TWILIO_SIP_TRUNK_SID

    logger.info(f"Updating Twilio trunk: {trunk_sid}")

    # Create or get credential list
    logger.info("Setting up credential list...")
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

    # Add credentials
    logger.info("Adding credentials...")
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

    # Associate credential list with trunk
    logger.info("Associating credential list with trunk...")
    try:
        trunk_cred_lists = client.trunking.v1.trunks(trunk_sid).credentials_lists.list()
        cred_list_associated = any(cl.sid == livekit_cred_list.sid for cl in trunk_cred_lists)

        if not cred_list_associated:
            client.trunking.v1.trunks(trunk_sid).credentials_lists.create(
                credential_list_sid=livekit_cred_list.sid
            )
            logger.info("✓ Credential list associated")
        else:
            logger.info("✓ Credential list already associated")
    except Exception as e:
        logger.warning(f"Could not verify association: {e}")

    # Add origination URL
    logger.info("Setting up origination URL...")
    existing_urls = client.trunking.v1.trunks(trunk_sid).origination_urls.list()
    livekit_url_exists = any(LIVEKIT_SIP_URI in url.sip_url for url in existing_urls)

    if not livekit_url_exists:
        origination_url = client.trunking.v1.trunks(trunk_sid).origination_urls.create(
            friendly_name="LiveKit SIP URI",
            sip_url=LIVEKIT_SIP_URI,
            priority=1,
            weight=1,
            enabled=True,
        )
        logger.info(f"✓ Origination URL created: {origination_url.sip_url}")
    else:
        logger.info(f"✓ Origination URL already exists")

    # Associate phone number
    if TWILIO_PHONE_NUMBER:
        logger.info(f"Associating phone number...")
        trunk_numbers = client.trunking.v1.trunks(trunk_sid).phone_numbers.list()
        number_associated = any(tn.phone_number == TWILIO_PHONE_NUMBER for tn in trunk_numbers)

        if not number_associated:
            phone_numbers = client.incoming_phone_numbers.list(phone_number=TWILIO_PHONE_NUMBER)
            if phone_numbers:
                phone_sid = phone_numbers[0].sid
                client.trunking.v1.trunks(trunk_sid).phone_numbers.create(phone_number_sid=phone_sid)
                logger.info(f"✓ Phone number associated: {TWILIO_PHONE_NUMBER}")
        else:
            logger.info(f"✓ Phone number already associated")

    logger.info("\n" + "="*60)
    logger.info("✅ Twilio Trunk Update Complete!")
    logger.info("="*60)
    logger.info(f"Trunk SID: {trunk_sid}")
    logger.info(f"Username: {TWILIO_SIP_USERNAME}")
    logger.info(f"LiveKit URI: {LIVEKIT_SIP_URI}")
    logger.info(f"Phone: {TWILIO_PHONE_NUMBER}")
    logger.info("="*60)

except Exception as e:
    logger.error(f"Error: {e}")
    sys.exit(1)
