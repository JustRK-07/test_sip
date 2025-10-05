# AI Voice Agent - LiveKit + Twilio + Python

A voice AI agent system that handles inbound and outbound phone calls using LiveKit Agents, Twilio SIP trunking, and Python.

## 🏗️ Architecture

```
Phone Call ↔ Twilio SIP Trunk ↔ LiveKit SIP ↔ LiveKit Room ↔ AI Agent (Python)
```

## 📋 Prerequisites

1. **Twilio Account** - [Sign up here](https://www.twilio.com/try-twilio)
   - Purchase a phone number
   - Get Account SID and Auth Token

2. **LiveKit Cloud Account** - [Sign up here](https://cloud.livekit.io/)
   - Create a project
   - Get API Key, Secret, and WebSocket URL

3. **OpenAI API Key** - For the LLM (or use alternative providers)

4. **Python 3.9+** installed

5. **Redis** (for LiveKit SIP service if self-hosting)

## 🚀 Quick Start

### 1. Clone and Setup

```bash
cd test_sip
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure Environment

Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your actual credentials:

```env
# LiveKit Configuration
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret

# Twilio Configuration
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_SIP_TRUNK_DOMAIN=your-trunk.pstn.twilio.com
TWILIO_SIP_USERNAME=your_sip_username
TWILIO_SIP_PASSWORD=your_sip_password

# AI Configuration
OPENAI_API_KEY=your_openai_api_key

# Agent Configuration
AGENT_NAME=telephony-agent
```

### 3. Setup Twilio SIP Trunk

Run the automated setup script:

```bash
python scripts/setup_twilio_trunk.py
```

This will:
- Create a Twilio SIP trunk
- Set up credential list
- Configure origination URL
- Associate your phone number

**Note:** You'll need the LiveKit SIP endpoint URI. Get it from your LiveKit dashboard or use:
- Global: `sip:sip.livekit.cloud`
- US West: `sip:sip-us-west.livekit.cloud`
- EU: `sip:sip-eu.livekit.cloud`

### 4. Create LiveKit Inbound Trunk

```bash
python scripts/create_inbound_trunk.py
```

This creates a LiveKit inbound trunk and dispatch rule for incoming calls.

### 5. Create LiveKit Outbound Trunk

```bash
python scripts/create_outbound_trunk.py
```

This creates a LiveKit outbound trunk for making calls.

**Important:** Save the trunk ID to your `.env.local`:

```env
LIVEKIT_OUTBOUND_TRUNK_ID=trunk_id_from_output
```

### 6. Run the Agent

```bash
python agent/agent.py dev
```

The agent is now running and ready to handle calls!

## 📞 Testing

### Test Inbound Calls

Simply call your Twilio phone number from any phone. The AI agent will answer and greet you!

### Test Outbound Calls

```bash
python scripts/test_call.py --phone "+15105551234"
```

The agent will call the specified number. Answer the call to test the conversation!

## 📁 Project Structure

```
test_sip/
├── .env.example              # Environment template
├── .env.local               # Your actual credentials (gitignored)
├── requirements.txt         # Python dependencies
├── README.md               # This file
│
├── config/
│   ├── livekit_config.py   # LiveKit configuration
│   └── twilio_config.py    # Twilio configuration
│
├── agent/
│   ├── agent.py            # Main agent implementation
│   ├── assistant.py        # AI assistant class
│   └── handlers.py         # Call event handlers
│
├── services/
│   ├── sip_manager.py      # SIP participant management
│   ├── dispatch_service.py # Agent dispatch logic
│   └── telephony_utils.py  # Telephony utilities
│
├── scripts/
│   ├── setup_twilio_trunk.py      # Automate Twilio setup
│   ├── create_inbound_trunk.py    # Create inbound trunk
│   ├── create_outbound_trunk.py   # Create outbound trunk
│   └── test_call.py               # Test outbound calling
│
└── utils/
    ├── logger.py           # Logging setup
    └── validators.py       # Phone number validation
```

## 🔧 Configuration Details

### Agent Configuration

The agent uses the following pipeline (configured in `agent/agent.py`):

- **STT**: AssemblyAI Universal Streaming
- **LLM**: OpenAI GPT-4o-mini
- **TTS**: Cartesia Sonic 2
- **VAD**: Silero VAD
- **Noise Cancellation**: BVC (Background Voice Cancellation)

You can modify these in `agent/agent.py` to use different providers.

### Customizing Agent Behavior

Edit `agent/assistant.py` to change the agent's instructions and personality:

```python
instructions="""You are a helpful AI voice assistant...
"""
```

## 🐛 Troubleshooting

### Agent not answering inbound calls

1. Check that your Twilio trunk origination URI points to the correct LiveKit SIP endpoint
2. Verify dispatch rule is created for the inbound trunk
3. Check agent logs for errors

### Outbound calls not working

1. Ensure `LIVEKIT_OUTBOUND_TRUNK_ID` is set in `.env.local`
2. Verify Twilio credentials are correct
3. Check that the outbound trunk is properly configured

### Authentication errors

1. Verify username and password match between Twilio and LiveKit trunks
2. Check that credential list is associated with Twilio trunk

### No audio/one-way audio

1. Check firewall settings (SIP uses RTP ports)
2. Verify noise cancellation is not too aggressive
3. Test with different network conditions

## 📚 Key Resources

- [LiveKit Agents Documentation](https://docs.livekit.io/agents/)
- [LiveKit SIP Documentation](https://docs.livekit.io/sip/)
- [Twilio SIP Trunking Guide](https://www.twilio.com/docs/sip-trunking)
- [LiveKit-Twilio Integration Guide](https://docs.livekit.io/sip/quickstarts/configuring-twilio-trunk/)

## 🔐 Security Notes

- Never commit `.env.local` to version control
- Use strong passwords for SIP authentication
- Restrict inbound trunk to Twilio IP ranges in production
- Implement rate limiting for outbound calls
- Monitor costs and usage

## 💰 Cost Considerations

- **Twilio**: Per-minute charges for calls + phone number rental
- **LiveKit**: Based on usage (check their pricing)
- **OpenAI API**: Per-token charges
- **AssemblyAI/Cartesia**: Per-minute charges (if applicable)

Set up billing alerts and implement call duration limits!

## 📝 License

This project is provided as-is for educational and development purposes.

## 🤝 Contributing

Feel free to submit issues and enhancement requests!
