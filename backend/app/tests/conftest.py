import pytest
import os
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Set test environment database URL before importing app settings
TEST_DATABASE_URL = (
    "postgresql://flientsec:flientsec_dev_pass@localhost:5433/flientsec_test"
)
os.environ["DATABASE_URL"] = TEST_DATABASE_URL

from app.main import app  # noqa: E402
from app.core.database import Base, get_db  # noqa: E402

from alembic.config import Config  # noqa: E402
from alembic import command  # noqa: E402

engine = create_engine(TEST_DATABASE_URL)
TestingSessionLocal = sessionmaker(
    autocommit=False, autoflush=False, bind=engine
)


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    # Force clean drop
    Base.metadata.drop_all(bind=engine)
    # Create all tables (current model schema state)
    Base.metadata.create_all(bind=engine)
    # Stamp Alembic state to head
    alembic_cfg = Config("alembic.ini")
    command.stamp(alembic_cfg, "head")
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
