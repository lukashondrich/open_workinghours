from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel, EmailStr, Field, validator
from pydantic_settings import BaseSettings


class SecuritySettings(BaseModel):
    secret_key: str = Field(..., min_length=32)
    token_exp_hours: int = Field(default=24 * 30, ge=1, le=24 * 365)
    email_hash_secret: str = Field(..., min_length=32)


class DatabaseSettings(BaseModel):
    url: str = Field(..., description="SQLAlchemy compatible database URL")


class EmailSettings(BaseModel):
    from_address: EmailStr
    smtp_host: str
    smtp_port: int = Field(default=587, ge=1, le=65535)
    smtp_username: str
    smtp_password: str
    use_tls: bool = True


class Settings(BaseSettings):
    environment: str = Field(default="development")
    allowed_email_domains_file: Path | None = Field(default=None)

    security: SecuritySettings
    database: DatabaseSettings
    email: EmailSettings | None = None

    class Config:
        env_nested_delimiter = "__"
        env_file = ".env"
        env_file_encoding = "utf-8"

    @validator("environment")
    def _normalize_environment(cls, value: str) -> str:
        return value.lower()


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[arg-type]
