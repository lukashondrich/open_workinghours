import logging
import smtplib
from email.message import EmailMessage

from .config import get_settings

settings = get_settings()
logger = logging.getLogger("email")


def send_email(recipient: str, subject: str, body: str) -> None:
    """
    Sends an email if SMTP credentials are configured.
    Falls back to logging to stdout when email settings are absent.
    """
    if settings.email is None:
        print(f"[email-placeholder] To: {recipient} Subject: {subject} Body: {body}")  # noqa: T201
        return

    email_config = settings.email
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = email_config.from_address
    message["To"] = recipient
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
            logger.info("Sent email to %s with subject: %s", recipient, subject)
    except Exception:  # noqa: BLE001
        logger.exception("Failed to send email")
        raise


def send_verification_email(recipient: str, content: str, subject: str | None = None) -> None:
    """
    Sends a verification email if SMTP credentials are configured.
    Falls back to logging to stdout when email settings are absent.

    Args:
        recipient: Email address to send to
        content: Verification code or message content
        subject: Optional custom subject (defaults to verification message)
    """
    default_subject = "Verify your hospital affiliation"
    email_subject = subject or default_subject

    # For verification emails, wrap content in standard body
    if subject is None:
        body = (
            "Hello,\n\n"
            "Please verify your hospital affiliation using the information below. "
            "The code is valid for 15 minutes.\n\n"
            f"{content}\n\n"
            "If you did not request this, you can ignore this email.\n"
        )
    else:
        # For custom subjects (like bug reports), use content as-is
        body = content

    send_email(recipient, email_subject, body)
