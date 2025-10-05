import re

def validate_phone_number(phone_number: str) -> bool:
    """
    Validate phone number format (E.164 format)

    Args:
        phone_number: Phone number string

    Returns:
        True if valid, False otherwise
    """
    # E.164 format: +[country code][number]
    pattern = r'^\+[1-9]\d{1,14}$'
    return bool(re.match(pattern, phone_number))

def format_phone_number(phone_number: str) -> str:
    """
    Format phone number to E.164 format

    Args:
        phone_number: Phone number string

    Returns:
        Formatted phone number
    """
    # Remove all non-digit characters except leading +
    cleaned = re.sub(r'[^\d+]', '', phone_number)

    # Add + if not present
    if not cleaned.startswith('+'):
        cleaned = '+' + cleaned

    return cleaned
