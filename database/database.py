import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

from sqlalchemy.ext.declarative import declarative_base

load_dotenv(dotenv_path=Path(__file__).parent.parent / "backend" / ".env")

# Define Base
Base = declarative_base()

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

if not SQLALCHEMY_DATABASE_URL:
    # Use a default if not set, but keep it secure or raise error
    SQLALCHEMY_DATABASE_URL = "postgresql://postgres:r0nN1E@localhost:5433/DECISIUM_LOPA"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_pre_ping=True,       # revalida conexões ociosas antes de usar
    pool_size=10,             # conexões mantidas no pool
    max_overflow=20,          # conexões extras permitidas sob carga
    pool_timeout=30,          # segundos para aguardar conexão disponível
    pool_recycle=1800,        # recicla conexões após 30 min (evita stale)
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
