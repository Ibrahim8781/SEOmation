import time
from typing import Any, Optional

_cache = {}

def set_with_ttl(key: str, value: Any, ttl_seconds: int):
    _cache[key] = (value, time.time() + ttl_seconds)

def get_if_fresh(key: str) -> Optional[Any]:
    item = _cache.get(key)
    if not item:
        return None
    val, exp = item
    if time.time() > exp:
        _cache.pop(key, None)
        return None
    return val
