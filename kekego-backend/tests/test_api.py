import json

import pytest
import yaml


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


@pytest.mark.django_db
def test_openapi_schema_served(api_client):
    response = api_client.get("/api/schema/", format="json")
    assert response.status_code == 200
    # drf-spectacular defaults to YAML here; yaml.safe_load also parses JSON.
    schema = yaml.safe_load(response.content)
    paths = schema["paths"]
    # The four auth operations must be present and documented.
    assert paths["/api/v1/auth/register/"]["post"]["requestBody"]
    assert paths["/api/v1/auth/login/"]["post"]
    assert paths["/api/v1/auth/refresh/"]["post"]
    assert paths["/api/v1/auth/me/"]["get"]
    assert "User" in schema["components"]["schemas"]


@pytest.mark.django_db
def test_swagger_ui_reachable(api_client):
    response = api_client.get("/api/docs/")
    assert response.status_code == 200
    assert b"swagger" in response.content.lower()