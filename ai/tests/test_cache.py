import pytest
from unittest.mock import patch
import time
from utils.cache import get_if_fresh, set_with_ttl

class TestCache:
    
    @patch('utils.cache._cache', {})
    def test_set_and_get_fresh_value(self):
        """Test setting and getting a fresh cached value"""
        key = "test_key"
        value = {"data": "test_data"}
        ttl = 60
        
        set_with_ttl(key, value, ttl)
        result = get_if_fresh(key)  # Only pass key, not ttl
        
        assert result == value
    
    @patch('utils.cache._cache', {})
    def test_get_expired_value_returns_none(self):
        """Test that expired cache returns None"""
        key = "test_key"
        value = {"data": "test_data"}
        ttl = 0.1  # 100ms
        
        set_with_ttl(key, value, ttl)
        time.sleep(0.2)  # Wait for expiration
        result = get_if_fresh(key)  # Only pass key
        
        assert result is None
    
    @patch('utils.cache._cache', {})
    def test_get_nonexistent_key_returns_none(self):
        """Test that non-existent key returns None"""
        result = get_if_fresh("nonexistent_key")  # Only pass key
        
        assert result is None
    
    @patch('utils.cache._cache', {})
    def test_cache_overwrites_existing_key(self):
        """Test that setting same key overwrites previous value"""
        key = "test_key"
        
        set_with_ttl(key, "old_value", 60)
        set_with_ttl(key, "new_value", 60)
        result = get_if_fresh(key)  # Only pass key
        
        assert result == "new_value"
    
    @patch('utils.cache._cache', {})
    def test_different_keys_independent(self):
        """Test that different keys are stored independently"""
        set_with_ttl("key1", "value1", 60)
        set_with_ttl("key2", "value2", 60)
        
        assert get_if_fresh("key1") == "value1"
        assert get_if_fresh("key2") == "value2"