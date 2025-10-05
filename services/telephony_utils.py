from utils.logger import setup_logger

logger = setup_logger("telephony_utils")

class TelephonyUtils:
    """
    Utility functions for telephony operations
    """

    @staticmethod
    def is_voicemail_detected(audio_level: float, silence_duration: float) -> bool:
        """
        Simple voicemail detection based on audio patterns

        Args:
            audio_level: Current audio level
            silence_duration: Duration of silence in seconds

        Returns:
            True if voicemail is likely detected
        """
        # This is a simplified detection
        # In production, use more sophisticated methods
        VOICEMAIL_SILENCE_THRESHOLD = 3.0  # seconds
        VOICEMAIL_AUDIO_THRESHOLD = 0.1

        if silence_duration > VOICEMAIL_SILENCE_THRESHOLD and audio_level < VOICEMAIL_AUDIO_THRESHOLD:
            logger.info("Possible voicemail detected")
            return True
        return False

    @staticmethod
    def should_hangup(call_duration: float, max_duration: float = 600) -> bool:
        """
        Determine if call should be hung up based on duration

        Args:
            call_duration: Current call duration in seconds
            max_duration: Maximum allowed duration in seconds (default: 10 minutes)

        Returns:
            True if call should be hung up
        """
        if call_duration >= max_duration:
            logger.warning(f"Call duration {call_duration}s exceeded max {max_duration}s")
            return True
        return False

    @staticmethod
    def parse_dtmf(dtmf_digit: str) -> str:
        """
        Parse and validate DTMF digit

        Args:
            dtmf_digit: DTMF digit received

        Returns:
            Validated DTMF digit or None
        """
        valid_dtmf = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '#']
        if dtmf_digit in valid_dtmf:
            logger.info(f"DTMF digit received: {dtmf_digit}")
            return dtmf_digit
        else:
            logger.warning(f"Invalid DTMF digit: {dtmf_digit}")
            return None
