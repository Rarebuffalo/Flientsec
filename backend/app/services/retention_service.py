import logging
import threading
from datetime import datetime, timedelta
from app.core import database
from app.models import models

logger = logging.getLogger(__name__)

_scheduler_thread = None
_stop_event = threading.Event()
_cleanup_lock = threading.Lock()


def purge_expired_checkruns(retention_days: int = 30, batch_size: int = 1000) -> int:
    """
    Performs safe batch deletion of expired CheckRun records across all organizations.
    Maintains Findings, Events, Evidence, and Audit histories intact.
    """
    if not _cleanup_lock.acquire(blocking=False):
        logger.info("Retention cleanup already running in another worker, skipping.")
        return 0

    total_deleted = 0
    db = database.SessionLocal()
    try:
        cutoff = datetime.utcnow() - timedelta(days=retention_days)
        while True:
            expired_ids = [
                r.id for r in db.query(models.CheckRun.id)
                .filter(models.CheckRun.timestamp < cutoff)
                .limit(batch_size)
                .all()
            ]
            if not expired_ids:
                break

            deleted = (
                db.query(models.CheckRun)
                .filter(models.CheckRun.id.in_(expired_ids))
                .delete(synchronize_session=False)
            )
            db.commit()
            total_deleted += deleted
            if deleted < batch_size:
                break

        if total_deleted > 0:
            logger.info(
                f"Automated retention cleanup: purged {total_deleted} expired CheckRuns "
                f"older than {retention_days} days."
            )
    except Exception as e:
        logger.error(f"Error during automated retention cleanup: {str(e)}")
        db.rollback()
    finally:
        db.close()
        _cleanup_lock.release()

    return total_deleted


def purge_expired_evidence(evidence_retention_days: int = 90, batch_size: int = 1000) -> int:
    """
    Performs safe batch deletion of expired audit Evidence records older than the compliance retention threshold.
    """
    total_deleted = 0
    db = database.SessionLocal()
    try:
        cutoff = datetime.utcnow() - timedelta(days=evidence_retention_days)
        while True:
            expired_ids = [
                r.id for r in db.query(models.Evidence.id)
                .filter(models.Evidence.evaluation_timestamp < cutoff)
                .limit(batch_size)
                .all()
            ]
            if not expired_ids:
                break

            deleted = (
                db.query(models.Evidence)
                .filter(models.Evidence.id.in_(expired_ids))
                .delete(synchronize_session=False)
            )
            db.commit()
            total_deleted += deleted
            if deleted < batch_size:
                break

        if total_deleted > 0:
            logger.info(
                f"Automated evidence retention cleanup: purged {total_deleted} expired Evidence records "
                f"older than {evidence_retention_days} days."
            )
    except Exception as e:
        logger.error(f"Error during automated evidence retention cleanup: {str(e)}")
        db.rollback()
    finally:
        db.close()

    return total_deleted


def _retention_worker(interval_seconds: int = 86400, retention_days: int = 30):
    """
    Background worker loop that triggers cleanup on interval.
    """
    logger.info(f"Started automated retention worker (interval: {interval_seconds}s, retention: {retention_days} days)")
    while not _stop_event.is_set():
        try:
            purge_expired_checkruns(retention_days=retention_days)
            purge_expired_evidence(evidence_retention_days=90)
        except Exception as e:
            logger.error(f"Retention worker loop exception: {str(e)}")

        # Wait for interval or stop signal
        _stop_event.wait(interval_seconds)


def start_retention_scheduler(interval_seconds: int = 86400, retention_days: int = 30):
    """
    Spawns background daemon thread for periodic retention cleanup.
    """
    global _scheduler_thread
    if _scheduler_thread and _scheduler_thread.is_alive():
        return

    _stop_event.clear()
    _scheduler_thread = threading.Thread(
        target=_retention_worker,
        args=(interval_seconds, retention_days),
        daemon=True,
        name="RetentionSchedulerThread"
    )
    _scheduler_thread.start()


def stop_retention_scheduler():
    """
    Signals retention scheduler thread to stop.
    """
    _stop_event.set()
