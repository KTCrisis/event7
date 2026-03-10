"""
Tests for P0-DELETE: Supabase mutation verification.

Placement: backend/tests/test_supabase_client.py
"""

from unittest.mock import MagicMock, patch

import pytest

from app.db.supabase_client import SupabaseClient

from tests.helpers import TEST_REGISTRY_ID, TEST_USER_ID


# ================================================================
# Helper: mock Supabase chained API
# ================================================================

def make_mock_supabase_response(data: list | None = None):
    response = MagicMock()
    response.data = data if data is not None else []
    return response


def make_chained_mock(final_response):
    chain = MagicMock()
    chain.select.return_value = chain
    chain.insert.return_value = chain
    chain.update.return_value = chain
    chain.upsert.return_value = chain
    chain.eq.return_value = chain
    chain.execute.return_value = final_response
    return chain


# ================================================================
# delete_registry
# ================================================================

class TestDeleteRegistry:

    def _make_client(self, response_data: list | None = None):
        with patch("app.db.supabase_client.create_client") as mock_create:
            mock_supabase = MagicMock()
            response = make_mock_supabase_response(response_data)
            chain = make_chained_mock(response)
            mock_supabase.table.return_value = chain
            mock_create.return_value = mock_supabase

            client = SupabaseClient("https://fake.supabase.co", "fake-key")
            client.client = mock_supabase
            return client

    def test_returns_false_when_no_rows_affected(self):
        client = self._make_client(response_data=[])
        result = client.delete_registry(
            registry_id=TEST_REGISTRY_ID,
            user_id=str(TEST_USER_ID),
        )
        assert result is False

    def test_returns_false_when_data_is_none(self):
        client = self._make_client(response_data=None)
        result = client.delete_registry(
            registry_id=TEST_REGISTRY_ID,
            user_id=str(TEST_USER_ID),
        )
        assert result is False

    def test_returns_true_when_row_affected(self):
        affected_row = {"id": TEST_REGISTRY_ID, "is_active": False}
        client = self._make_client(response_data=[affected_row])
        result = client.delete_registry(
            registry_id=TEST_REGISTRY_ID,
            user_id=str(TEST_USER_ID),
        )
        assert result is True

    def test_scopes_delete_by_user_id(self):
        with patch("app.db.supabase_client.create_client") as mock_create:
            mock_supabase = MagicMock()
            response = make_mock_supabase_response([{"id": "x"}])
            chain = make_chained_mock(response)
            mock_supabase.table.return_value = chain
            mock_create.return_value = mock_supabase

            client = SupabaseClient("https://fake.supabase.co", "fake-key")
            client.client = mock_supabase

            client.delete_registry(
                registry_id=TEST_REGISTRY_ID,
                user_id=str(TEST_USER_ID),
            )

            eq_calls = chain.eq.call_args_list
            eq_args = [(c.args[0], c.args[1]) for c in eq_calls]
            assert ("id", TEST_REGISTRY_ID) in eq_args
            assert ("user_id", str(TEST_USER_ID)) in eq_args


# ================================================================
# get_registry_by_id
# ================================================================

class TestGetRegistryById:

    def _make_client(self, response_data: list | None = None):
        with patch("app.db.supabase_client.create_client") as mock_create:
            mock_supabase = MagicMock()
            response = make_mock_supabase_response(response_data)
            chain = make_chained_mock(response)
            mock_supabase.table.return_value = chain
            mock_create.return_value = mock_supabase

            client = SupabaseClient("https://fake.supabase.co", "fake-key")
            client.client = mock_supabase
            return client

    def test_returns_none_when_not_found(self):
        client = self._make_client(response_data=[])
        result = client.get_registry_by_id(TEST_REGISTRY_ID, str(TEST_USER_ID))
        assert result is None

    def test_returns_registry_when_found(self):
        row = {"id": TEST_REGISTRY_ID, "name": "My Registry"}
        client = self._make_client(response_data=[row])
        result = client.get_registry_by_id(TEST_REGISTRY_ID, str(TEST_USER_ID))
        assert result == row

    def test_returns_first_row_only(self):
        rows = [
            {"id": "first", "name": "First"},
            {"id": "second", "name": "Second"},
        ]
        client = self._make_client(response_data=rows)
        result = client.get_registry_by_id(TEST_REGISTRY_ID, str(TEST_USER_ID))
        assert result["id"] == "first"


# ================================================================
# create_registry
# ================================================================

class TestCreateRegistry:

    def _make_client(self, response_data: list | None = None):
        with patch("app.db.supabase_client.create_client") as mock_create:
            mock_supabase = MagicMock()
            response = make_mock_supabase_response(response_data)
            chain = make_chained_mock(response)
            mock_supabase.table.return_value = chain
            mock_create.return_value = mock_supabase

            client = SupabaseClient("https://fake.supabase.co", "fake-key")
            client.client = mock_supabase
            return client

    def test_returns_none_when_insert_fails(self):
        client = self._make_client(response_data=[])
        result = client.create_registry({"name": "test", "user_id": "x"})
        assert result is None

    def test_returns_row_on_success(self):
        row = {"id": "new-id", "name": "test"}
        client = self._make_client(response_data=[row])
        result = client.create_registry({"name": "test"})
        assert result["id"] == "new-id"


# ================================================================
# upsert_enrichment
# ================================================================

class TestUpsertEnrichment:

    def _make_client(self, response_data: list | None = None):
        with patch("app.db.supabase_client.create_client") as mock_create:
            mock_supabase = MagicMock()
            response = make_mock_supabase_response(response_data)
            chain = make_chained_mock(response)
            mock_supabase.table.return_value = chain
            mock_create.return_value = mock_supabase

            client = SupabaseClient("https://fake.supabase.co", "fake-key")
            client.client = mock_supabase
            return client

    def test_returns_none_when_upsert_fails(self):
        client = self._make_client(response_data=[])
        result = client.upsert_enrichment({"registry_id": "x", "subject": "y"})
        assert result is None

    def test_returns_row_on_success(self):
        row = {"id": "enr-id", "subject": "test-subject"}
        client = self._make_client(response_data=[row])
        result = client.upsert_enrichment({"registry_id": "x", "subject": "y"})
        assert result["id"] == "enr-id"


# ================================================================
# audit_log
# ================================================================

class TestAuditLog:

    def test_audit_log_does_not_raise_on_error(self):
        with patch("app.db.supabase_client.create_client") as mock_create:
            mock_supabase = MagicMock()
            chain = MagicMock()
            chain.insert.return_value = chain
            chain.execute.side_effect = Exception("DB down")
            mock_supabase.table.return_value = chain
            mock_create.return_value = mock_supabase

            client = SupabaseClient("https://fake.supabase.co", "fake-key")
            client.client = mock_supabase

            # Must NOT raise
            client.log_audit(
                user_id=str(TEST_USER_ID),
                registry_id=TEST_REGISTRY_ID,
                action="test.action",
                details={"key": "value"},
            )


# ================================================================
# Regression guards
# ================================================================

class TestSupabaseClientRegression:

    def test_delete_registry_requires_user_id(self):
        import inspect
        sig = inspect.signature(SupabaseClient.delete_registry)
        params = list(sig.parameters.keys())
        assert "user_id" in params
        assert "registry_id" in params

    def test_get_registry_by_id_requires_user_id(self):
        import inspect
        sig = inspect.signature(SupabaseClient.get_registry_by_id)
        params = list(sig.parameters.keys())
        assert "user_id" in params
        assert "registry_id" in params

    def test_get_registries_requires_user_id(self):
        import inspect
        sig = inspect.signature(SupabaseClient.get_registries)
        params = list(sig.parameters.keys())
        assert "user_id" in params