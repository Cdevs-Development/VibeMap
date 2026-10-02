import re
from typing import Set, Tuple


def normalize_phone(phone: str) -> str:
    """
    Normalizes a phone number to standard international format (e.g., +2348012345678).
    """
    if not phone:
        return ""
    
    raw = phone.strip()
    digits = re.sub(r"\D", "", raw)
    if not digits:
        return ""

    # Nigerian numbers starting with 234
    if digits.startswith("234") and len(digits) >= 12:
        return f"+{digits}"

    # Nigerian numbers starting with 0 (e.g. 08012345678)
    if digits.startswith("0") and len(digits) == 11:
        return f"+234{digits[1:]}"

    # 10 digits without leading zero (e.g. 8012345678)
    if len(digits) == 10 and digits[0] in ("7", "8", "9", "1", "2"):
        return f"+234{digits}"

    # International number starting with +
    if raw.startswith("+") and 10 <= len(digits) <= 15:
        return f"+{digits}"

    # Standard fallback
    if len(digits) == 11 and digits.startswith("0"):
        return f"+234{digits[1:]}"

    if len(digits) == 10:
        return f"+234{digits}"

    return f"+{digits}"


def validate_and_normalize_phone(phone: str) -> Tuple[bool, str, str]:
    """
    Validates and normalizes a phone number.
    Returns (is_valid, normalized_phone_or_empty, error_message_or_empty).
    """
    if not phone or not isinstance(phone, str):
        return False, "", "Phone number is required"

    raw = phone.strip()
    digits = re.sub(r"\D", "", raw)

    if not digits or len(digits) < 10:
        return False, "", "Please provide a valid phone number with at least 10 digits"

    if len(digits) > 15:
        return False, "", "Phone number is too long (maximum 15 digits)"

    norm = normalize_phone(raw)
    norm_digits = re.sub(r"\D", "", norm)

    if 10 <= len(norm_digits) <= 15:
        return True, norm, ""

    return False, "", "Invalid phone number format (e.g. 08012345678 or +2348012345678)"


def get_phone_variants(phone: str) -> Set[str]:
    """
    Returns all possible standard string variants for a phone number
    to support seamless lookups across legacy/different formats.
    """
    variants = set()
    if not phone:
        return variants
    
    raw = phone.strip()
    digits = re.sub(r"\D", "", raw)
    variants.add(raw)
    
    if digits:
        variants.add(digits)
        
        # If Nigerian format
        if digits.startswith("234") and len(digits) >= 12:
            variants.add(f"+{digits}")
            variants.add(f"0{digits[3:]}")
            variants.add(digits[3:])
        elif digits.startswith("0") and len(digits) == 11:
            variants.add(f"+234{digits[1:]}")
            variants.add(f"234{digits[1:]}")
            variants.add(digits[1:])
        elif len(digits) == 10:
            variants.add(f"+234{digits}")
            variants.add(f"234{digits}")
            variants.add(f"0{digits}")
        else:
            if raw.startswith("+"):
                variants.add(raw)
            else:
                variants.add(f"+{digits}")
                
    return variants
