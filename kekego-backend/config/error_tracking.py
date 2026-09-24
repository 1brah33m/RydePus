"""Optional remote error tracking.

When ``SENTRY_DSN`` is set in the environment, the ``sentry-sdk`` (if
installed) SDK is initialised so unhandled exceptions and slow queries can be
captured by Sentry. Without ``SENTRY_DSN`` every call becomes a no-op, so the
rest of the codebase can call this module unconditionally.
"""

import logging
import os

logger = logging.getLogger("campus_keke.errors")


def init_error_tracking() -> None:
    """Initialise Sentry when configured. Safe to call multiple times."""
    dsn = os.environ.get("SENTRY_DSN", "").strip()
    if not dsn:
        logger.debug("SENTRY_DSN not set; skipping remote error tracking.")
        return
    try:
        import sentry_sdk
        from sentry_sdk.integrations.django import DjangoIntegration

        sentry_sdk.init(
            dsn=dsn,
            integrations=[DjangoIntegration()],
            traces_sample_rate=float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0.1")),
            environment=os.environ.get("DJANGO_ENV", "production"),
            release=os.environ.get("RYDEPUS_RELEASE", "").strip() or None,
            send_default_pii=False,
        )
        logger.info("Sentry error tracking initialised (dsn configured).")
    except ImportError:
        logger.warning("SENTRY_DSN is set but sentry-sdk is not installed; add it to requirements for remote tracking.")


def capture_exception(exception: BaseException, **tags) -> None:
    """Forward an exception to the configured tracker, or log locally."""
    try:
        import sentry_sdk

        with sentry_sdk.configure_scope() as scope:
            for key, value in tags.items():
                scope.set_tag(str(key), str(value))
        sentry_sdk.capture_exception(exception)
    except ImportError:
        logger.error("captured_error type=%s", type(exception).__name__)
