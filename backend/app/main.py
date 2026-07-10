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
    
    # Seed default company, user, and policy
    db = database.SessionLocal()
    
    # 1. Seed Company
    company_id = None
    try:
        company = db.query(models.Company).order_by(models.Company.created_at.asc()).first()
        if not company:
            company = models.Company(name="FlientSec Default Corp")
            db.add(company)
            db.commit()
            db.refresh(company)
            logger.info(f"Seeded default company: {company.name}")
        else:
            logger.info(f"Default company already exists: {company.name}")
        company_id = company.id
    except Exception as e:
        logger.error(f"Error seeding company: {str(e)}")
        db.rollback()

    # 2. Seed Admin User
    if company_id:
        try:
            admin_email = "admin@flientsec.local"
            admin_user = db.query(models.User).filter(models.User.email == admin_email).first()
            if not admin_user:
                admin_user = models.User(
                    email=admin_email,
                    hashed_password=security.get_password_hash("flientsec_admin_pass"),
                    role="admin",
                    company_id=company_id
                )
                db.add(admin_user)
                db.commit()
                logger.info(f"Seeded default admin user: {admin_email}")
            else:
                # Update password to ensure it matches flientsec_admin_pass
                admin_user.hashed_password = security.get_password_hash("flientsec_admin_pass")
                admin_user.company_id = company_id
                db.commit()
                logger.info(f"Admin user already exists. Updated/Verified credentials for: {admin_email}")
        except Exception as e:
            logger.error(f"Error seeding admin user: {str(e)}")
            db.rollback()

    # 3. Seed Default Policy
    try:
        endpoints.get_policies(db)
        logger.info("Seeded default organization security policies.")
    except Exception as e:
        logger.error(f"Error seeding default policy: {str(e)}")
        db.rollback()
    finally:
        db.close()
