from livekit import rtc
from utils.logger import setup_logger

logger = setup_logger("handlers")

class CallHandlers:
    """
    Handlers for various call events
    """

    @staticmethod
    async def on_participant_connected(participant: rtc.RemoteParticipant):
        """Called when a participant joins the room"""
        logger.info(f"Participant connected: {participant.identity}")

    @staticmethod
    async def on_participant_disconnected(participant: rtc.RemoteParticipant):
        """Called when a participant leaves the room"""
        logger.info(f"Participant disconnected: {participant.identity}")

    @staticmethod
    async def on_track_subscribed(
        track: rtc.Track,
        publication: rtc.TrackPublication,
        participant: rtc.RemoteParticipant,
    ):
        """Called when a track is subscribed"""
        logger.info(f"Track subscribed: {track.kind} from {participant.identity}")

    @staticmethod
    async def on_data_received(data: rtc.DataPacket):
        """Called when data is received (e.g., DTMF)"""
        logger.info(f"Data received: {data}")
