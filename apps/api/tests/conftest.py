import os

import pytest


@pytest.fixture(autouse=True)
def setup_testing_env():
    """Set up testing environment"""
    os.environ["FLASK_ENV"] = "testing"
    yield
    if "FLASK_ENV" in os.environ:
        del os.environ["FLASK_ENV"]


@pytest.fixture
def client():
    from app import app

    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client
