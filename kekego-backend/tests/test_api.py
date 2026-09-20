import pytest


@pytest.mark.django_db
def test_health_check_returns_ok_without_authentication(api_client):
    response = api_client.get("/api/v1/health/")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.django_db
def test_unknown_route_uses_consistent_error_format(api_client):
    response = api_client.get("/api/v1/does-not-exist/")
    assert response.status_code == 404
    body = response.json()
    assert "error" in body
    assert body["error"]["code"] == "NOT_FOUND"
    assert body["error"]["message"]