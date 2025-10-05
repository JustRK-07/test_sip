import os
import sys
from dotenv import load_dotenv
from livekit import agents
from livekit.agents import AgentSession, RoomInputOptions
from livekit.plugins import noise_cancellation, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel
import json

# Add current and parent directory to path
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.insert(0, parent_dir)
sys.path.insert(0, current_dir)

from agent.assistant import VoiceAssistant
from agent.handlers import CallHandlers
from utils.logger import setup_logger

load_dotenv(".env.local")
load_dotenv(".env")

logger = setup_logger("agent")

async def entrypoint(ctx: agents.JobContext):
    """
    Main entry point for the AI agent

    This function is called when:
    1. An inbound call comes in (via dispatch rule)
    2. An outbound call is initiated (via dispatch API)
    """
    logger.info(f"Agent starting - Room: {ctx.room.name}")

    # Parse metadata for phone number (used for outbound calls)
    phone_number = None
    if ctx.job.metadata:
        try:
            metadata = json.loads(ctx.job.metadata)
            phone_number = metadata.get("phone_number")
            logger.info(f"Outbound call to: {phone_number}")
        except json.JSONDecodeError:
            logger.warning("Failed to parse job metadata")

    # Connect to the room
    await ctx.connect()
    logger.info("Agent connected to room")

    # Set up the agent session with STT, LLM, TTS pipeline
    session = AgentSession(
        # Speech-to-Text: AssemblyAI Universal Streaming
        stt="assemblyai/universal-streaming:en",

        # Large Language Model: OpenAI GPT-4
        llm="openai/gpt-4o-mini",

        # Text-to-Speech: Cartesia Sonic
        tts="cartesia/sonic-2:9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",

        # Voice Activity Detection
        vad=silero.VAD.load(),

        # Turn detection for conversation flow
        turn_detection=MultilingualModel(),
    )

    # Start the agent session
    await session.start(
        room=ctx.room,
        agent=VoiceAssistant(),
        room_input_options=RoomInputOptions(
            noise_cancellation=noise_cancellation.BVC(),
        ),
    )

    # Set up event handlers
    ctx.room.on("participant_connected", CallHandlers.on_participant_connected)
    ctx.room.on("participant_disconnected", CallHandlers.on_participant_disconnected)

    # For inbound calls, greet the caller
    if not phone_number:
        logger.info("Inbound call detected - greeting caller")
        await session.generate_reply("Hello! This is your AI assistant. How can I help you today?")
    else:
        # For outbound calls, wait for the user to speak first
        logger.info("Outbound call - waiting for user to speak")

    logger.info("Agent session started successfully")


if __name__ == "__main__":
    # Run the agent in development mode
    agents.cli.run_app(
        agents.WorkerOptions(
            entrypoint_fnc=entrypoint,
            agent_name=os.getenv("AGENT_NAME", "telephony-agent"),
            api_key=os.getenv("LIVEKIT_API_KEY"),
            api_secret=os.getenv("LIVEKIT_API_SECRET"),
            ws_url=os.getenv("LIVEKIT_URL"),
        )
    )
