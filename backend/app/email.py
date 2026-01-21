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


def send_inquiry_notification(
    inquiry_id: int,
    name: str,
    organization: str,
    role: str,
    email: str,
    message: str,
) -> None:
    """
    Send notification email when a new institution inquiry is submitted.

    Sends to notification_email if configured, otherwise from_address.
    """
    if settings.email is None:
        print(f"[email-placeholder] New inquiry #{inquiry_id} from {name} ({organization})")  # noqa: T201
        return

    recipient = settings.email.notification_email or settings.email.from_address
    subject = f"[OWH] New Institution Inquiry from {organization}"

    body = f"""New inquiry submitted via the public dashboard.

Inquiry ID: {inquiry_id}
Name: {name}
Organization: {organization}
Role: {role}
Email: {email}

Message:
{message}

---
Reply directly to this inquiry at: {email}
View all inquiries at: https://api.openworkinghours.org/admin
"""

    try:
        send_email(recipient, subject, body)
    except Exception:  # noqa: BLE001
        # Log but don't fail the request - inquiry is already saved
        logger.exception("Failed to send inquiry notification email")


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
    # Code appears FIRST so it's visible in email preview (~100 chars)
    # Bilingual: first line works for both EN/DE, then separate instructions
    if subject is None:
        body = (
            f"{content}\n\n"
            "Use this code to log in. Valid for 15 minutes.\n"
            "Verwenden Sie diesen Code zum Anmelden. Gültig für 15 Minuten.\n\n"
            "If you did not request this, you can ignore this email.\n"
            "Falls Sie dies nicht angefordert haben, können Sie diese E-Mail ignorieren.\n"
        )
    else:
        # For custom subjects (like bug reports), use content as-is
        body = content

    send_email(recipient, email_subject, body)
