import re

EMAIL_PATTERN = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
PHONE_PATTERN = re.compile(r"\+?\d[\d\s().-]{6,}")


def scrub_text(value: str | None) -> str | None:
    if not value:
        return value
    scrubbed = EMAIL_PATTERN.sub("[redacted-email]", value)
    scrubbed = PHONE_PATTERN.sub("[redacted-phone]", scrubbed)
    return scrubbed
