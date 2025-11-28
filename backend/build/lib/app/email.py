import logging
import smtplib
from email.message import EmailMessage

from .config import get_settings

settings = get_settings()
logger = logging.getLogger("email")


def send_verification_email(recipient: str, content: str) -> None:
    """
    Sends a verification email if SMTP credentials are configured.
    Falls back to logging to stdout when email settings are absent.
    """
    if settings.email is None:
        print(f"[email-placeholder] To: {recipient} Content: {content}")  # noqa: T201
        return

    email_config = settings.email
    message = EmailMessage()
    message["Subject"] = "Verify your hospital affiliation"
    message["From"] = email_config.from_address
    message["To"] = recipient
    body = (
        "Hello,\n\n"
        "Please verify your hospital affiliation using the information below. "
        "The code is valid for 15 minutes.\n\n"
        f"{content}\n\n"
        "If you did not request this, you can ignore this email.\n"
    )
    message.set_content(body)

    try:
        with smtplib.SMTP(email_config.smtp_host, email_config.smtp_port, timeout=30) as smtp:
            smtp.set_debuglevel(1)
            smtp.ehlo()
            if email_config.use_tls:
                smtp.starttls()
                smtp.ehlo()
            smtp.login(email_config.smtp_username, email_config.smtp_password)
            smtp.send_message(message)
            logger.info("Sent verification email to %s", recipient)
    except Exception:  # noqa: BLE001
        logger.exception("Failed to send verification email")
        raise
