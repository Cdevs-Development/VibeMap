# =====================================================
# IMPORTS
# =====================================================

from slowapi import Limiter
from slowapi.util import get_remote_address


# =====================================================
# SHARED RATE LIMITER
# =====================================================

limiter = Limiter(
    key_func=get_remote_address
)