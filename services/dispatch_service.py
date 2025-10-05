import json
from livekit import api
from config.livekit_config import LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, AGENT_NAME
from utils.logger import setup_logger
from utils.validators import validate_phone_number, format_phone_number

logger = setup_logger("dispatch_service")

class DispatchService:
    """
    Handles agent dispatch for outbound calls
    """

    def __init__(self):
        self.livekit_api = api.LiveKitAPI(
            url=LIVEKIT_URL,
            api_key=LIVEKIT_API_KEY,
            api_secret=LIVEKIT_API_SECRET,
        )
        logger.info("DispatchService initialized")

    async def dispatch_outbound_call(
        self,
        phone_number: str,
        room_name: str = None,
        agent_name: str = None,
    ):
        """
        Dispatch an agent for an outbound call

        Args:
            phone_number: Phone number to call (E.164 format)
            room_name: Optional room name (auto-generated if not provided)
            agent_name: Optional agent name (uses AGENT_NAME from config if not provided)

        Returns:
            Dispatch info
        """
        # Validate and format phone number
        phone_number = format_phone_number(phone_number)
        if not validate_phone_number(phone_number):
            raise ValueError(f"Invalid phone number format: {phone_number}")

        # Generate room name if not provided
        if not room_name:
            import uuid
            room_name = f"outbound-call-{uuid.uuid4().hex[:8]}"

        # Use default agent name if not provided
        if not agent_name:
            agent_name = AGENT_NAME

        # Create metadata with phone number
        metadata = json.dumps({"phone_number": phone_number})

        logger.info(f"Dispatching agent '{agent_name}' to call {phone_number} in room {room_name}")

        try:
            dispatch = await self.livekit_api.agent_dispatch.create_dispatch(
                api.CreateAgentDispatchRequest(
                    agent_name=agent_name,
                    room=room_name,
                    metadata=metadata,
                )
            )
            logger.info(f"Agent dispatched - ID: {dispatch.id}, Room: {room_name}")
            return {
                "dispatch_id": dispatch.id,
                "room_name": room_name,
                "phone_number": phone_number,
                "agent_name": agent_name,
            }

        except Exception as e:
            logger.error(f"Failed to dispatch agent: {e}")
            raise

    async def delete_dispatch(self, dispatch_id: str, room_name: str):
        """
        Delete an agent dispatch

        Args:
            dispatch_id: Dispatch ID
            room_name: Room name

        Returns:
            Delete response
        """
        try:
            await self.livekit_api.agent_dispatch.delete_dispatch(
                api.DeleteAgentDispatchRequest(
                    dispatch_id=dispatch_id,
                    room=room_name,
                )
            )
            logger.info(f"Dispatch deleted - ID: {dispatch_id}")

        except Exception as e:
            logger.error(f"Failed to delete dispatch: {e}")
            raise

    def close(self):
        """Close the API connection"""
        self.livekit_api.aclose()
        logger.info("DispatchService closed")
