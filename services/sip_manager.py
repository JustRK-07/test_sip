from livekit import api
from config.livekit_config import LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET
from utils.logger import setup_logger
from utils.validators import validate_phone_number, format_phone_number

logger = setup_logger("sip_manager")

class SIPManager:
    """
    Manages SIP participants and call operations
    """

    def __init__(self):
        self.livekit_api = api.LiveKitAPI(
            url=LIVEKIT_URL,
            api_key=LIVEKIT_API_KEY,
            api_secret=LIVEKIT_API_SECRET,
        )
        logger.info("SIPManager initialized")

    async def create_outbound_call(
        self,
        phone_number: str,
        room_name: str,
        trunk_id: str,
        participant_identity: str = None,
        participant_name: str = None,
    ):
        """
        Create an outbound call to a phone number

        Args:
            phone_number: Phone number to call (E.164 format)
            room_name: LiveKit room name
            trunk_id: SIP trunk ID for outbound calls
            participant_identity: Optional participant identity
            participant_name: Optional participant name

        Returns:
            SIP participant info
        """
        # Validate and format phone number
        phone_number = format_phone_number(phone_number)
        if not validate_phone_number(phone_number):
            raise ValueError(f"Invalid phone number format: {phone_number}")

        logger.info(f"Creating outbound call to {phone_number} in room {room_name}")

        try:
            participant = await self.livekit_api.sip.create_sip_participant(
                api.CreateSIPParticipantRequest(
                    sip_trunk_id=trunk_id,
                    sip_call_to=phone_number,
                    room_name=room_name,
                    participant_identity=participant_identity or f"caller-{phone_number}",
                    participant_name=participant_name or phone_number,
                )
            )
            logger.info(f"Outbound call created - Participant: {participant.participant_identity}")
            return participant

        except Exception as e:
            logger.error(f"Failed to create outbound call: {e}")
            raise

    async def get_sip_trunk(self, trunk_id: str):
        """
        Get SIP trunk information

        Args:
            trunk_id: SIP trunk ID

        Returns:
            SIP trunk info
        """
        try:
            trunk = await self.livekit_api.sip.get_sip_trunk(trunk_id)
            return trunk
        except Exception as e:
            logger.error(f"Failed to get SIP trunk: {e}")
            raise

    async def list_sip_trunks(self):
        """
        List all SIP trunks

        Returns:
            List of SIP trunks
        """
        try:
            trunks = await self.livekit_api.sip.list_sip_trunk()
            return trunks
        except Exception as e:
            logger.error(f"Failed to list SIP trunks: {e}")
            raise

    def close(self):
        """Close the API connection"""
        self.livekit_api.aclose()
        logger.info("SIPManager closed")
