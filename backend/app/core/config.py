import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    PROJECT_NAME: str = "Cronograma Backend"

    # Banco SQLite local
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "sqlite:///./database.db"
    )

settings = Settings()
