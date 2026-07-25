import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core import database, security
from app.models import models
from app.api import endpoints

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="FlientSec API", version="1.0.0")

# Setup CORS middleware to allow requests from the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For MVP development simplicity
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Router
app.include_router(endpoints.router, prefix="/api/v1")

import time
from sqlalchemy.exc import OperationalError

@app.on_event("startup")
def startup_event():
    logger.info("Initializing database schemas...")
    
    retries = 15
    while retries > 0:
        try:
            database.init_db()
            break
        except Exception as e:
            retries -= 1
            logger.warning(f"Database connection not ready yet: {str(e)}. Retrying in 2 seconds... ({retries} retries left)")
            time.sleep(2)
    else:
        logger.error("Database connection failed. Exiting.")
        raise Exception("Database connection failed")
    
    # Seed default organization, user, and policy
    db = database.SessionLocal()
    try:
        endpoints.ensure_default_data(db)
        admin_user = db.query(models.User).filter(models.User.email == "admin@flientsec.local").first()
        if admin_user:
            endpoints.seed_default_policy(db, admin_user)
            logger.info("Successfully seeded default organization, admin user, and security policies.")
    except Exception as e:
        logger.error(f"Error seeding default database parameters: {str(e)}")
        db.rollback()
    finally:
        db.close()
