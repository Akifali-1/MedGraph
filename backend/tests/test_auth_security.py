import os
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

os.environ["TESTING"] = "true"
os.environ["ALLOW_TEST_AUTH"] = "true"
os.environ["ALLOW_MOCK_AUTH"] = "true"

from backend.auth import RegisterRequest, Role, register_user
from backend.graph.client import MOCK_INTERACTIONS, Neo4jClient
from backend.knowledge import processor
from backend.main import GoogleLoginRequest, google_login


def test_mock_google_credential_is_rejected_outside_explicit_test_mode(monkeypatch):
    monkeypatch.setenv("TESTING", "false")
    monkeypatch.setenv("ALLOW_MOCK_AUTH", "true")

    with pytest.raises(HTTPException) as exc_info:
        google_login(
            GoogleLoginRequest(
                credential="mock_google_jwt_token",
                role=Role.patient,
            )
        )

    assert exc_info.value.status_code == 401


def test_public_registration_cannot_choose_an_arbitrary_tenant(monkeypatch):
    monkeypatch.setenv("DEFAULT_TENANT_ID", "server-clinic")
    monkeypatch.setattr("backend.auth.DEFAULT_TENANT_ID", "server-clinic")

    user = register_user(
        RegisterRequest(
            email="tenant-bound@example.com",
            password="long-enough-password",
            role=Role.patient,
            name="Tenant Bound",
        )
    )

    assert user.tenant_id == "server-clinic"


def test_mock_private_ddi_is_stored_for_each_doctor(monkeypatch):
    original_interactions = list(MOCK_INTERACTIONS)
    monkeypatch.setattr(
        processor,
        "get_neo4j_client",
        lambda: SimpleNamespace(use_mock=True),
    )

    csv_bytes = b"drug1,drug2,severity,effect\nDrug A,Drug B,HIGH,private test risk\n"
    try:
        processor.process_ddi_csv(csv_bytes, doctor_id="doctor-a")
        processor.process_ddi_csv(csv_bytes, doctor_id="doctor-b")

        client = Neo4jClient.__new__(Neo4jClient)
        client.use_mock = True
        doctor_a_results = client.query_drug_interactions(["Drug A", "Drug B"], doctor_id="doctor-a")
        doctor_b_results = client.query_drug_interactions(["Drug A", "Drug B"], doctor_id="doctor-b")

        assert doctor_a_results
        assert doctor_b_results
        assert all(item["effect"] == "private test risk" for item in doctor_a_results)
        assert all(item["effect"] == "private test risk" for item in doctor_b_results)
    finally:
        MOCK_INTERACTIONS[:] = original_interactions
