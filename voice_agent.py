#!/usr/bin/env python3
"""
AI Voice Agent for LiveKit + Twilio SIP Calls
"""
import os
import json
from dotenv import load_dotenv
from livekit import agents
from livekit.agents import Agent, AgentSession, RoomInputOptions
from livekit.plugins import noise_cancellation, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

# Load environment
load_dotenv(".env.local")
load_dotenv(".env")

# Set environment variables for subprocess
os.environ["LIVEKIT_URL"] = os.getenv("LIVEKIT_URL")
os.environ["LIVEKIT_API_KEY"] = os.getenv("LIVEKIT_API_KEY")
os.environ["LIVEKIT_API_SECRET"] = os.getenv("LIVEKIT_API_SECRET")
os.environ["OPENAI_API_KEY"] = os.getenv("OPENAI_API_KEY")

class VoiceAssistant(Agent):
    """AI Voice Assistant for handling phone calls"""

    def __init__(self) -> None:
        super().__init__(
            instructions="""You are a helpful AI voice assistant that answers phone calls.

            Your role is to:
            - Greet callers warmly and professionally
            - Listen carefully to what they need
            - Provide clear, concise, and helpful responses
            - Speak naturally and conversationally
            - Be polite and patient

            Keep your responses brief and to the point since this is a phone conversation.
            If you don't understand something, politely ask the caller to repeat or clarify.
            """
        )

async def entrypoint(ctx: agents.JobContext):
    """Main entry point for the AI agent"""
    print(f"✓ Agent starting - Room: {ctx.room.name}")

    # Parse metadata for phone number (used for outbound calls)
    phone_number = None
    if ctx.job.metadata:
        try:
            metadata = json.loads(ctx.job.metadata)
            phone_number = metadata.get("phone_number")
            print(f"✓ Outbound call to: {phone_number}")
        except json.JSONDecodeError:
            pass

    # Connect to the room
    await ctx.connect()
    print("✓ Agent connected to room")

    # Set up the agent session with STT, LLM, TTS pipeline
    session = AgentSession(
        # Speech-to-Text
        stt="assemblyai/universal-streaming:en",

        # Large Language Model
        llm="openai/gpt-4o-mini",

        # Text-to-Speech
        tts="cartesia/sonic-2:9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",

        # Voice Activity Detection
        vad=silero.VAD.load(),

        # Turn detection
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

    # For inbound calls, greet the caller
    if not phone_number:
        print("✓ Inbound call - greeting caller")
        await session.generate_reply("Hello! This is your AI assistant. How can I help you today?")
    else:
        # For outbound calls, wait for the user to speak first
        print("✓ Outbound call - waiting for user")

    print("✅ Agent session started successfully")

if __name__ == "__main__":
    print("="*60)
    print("🎙️  AI Voice Agent - LiveKit + Twilio")
    print("="*60)
    print(f"LiveKit URL: {os.getenv('LIVEKIT_URL')}")
    print(f"Agent Name: {os.getenv('AGENT_NAME', 'telephony-agent')}")
    print("="*60)
    print("\n🚀 Starting agent... Press Ctrl+C to stop\n")

    # Run the agent
    agents.cli.run_app(
        agents.WorkerOptions(
            entrypoint_fnc=entrypoint,
            agent_name=os.getenv("AGENT_NAME", "telephony-agent"),
        )
    )
