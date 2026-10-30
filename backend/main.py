import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routes.evidence import router as evidence_router
from app.routes.activities import router as activities_router
from app.routes.reconciliation import router as reconciliation_router
from app.routes.public import router as public_router
from app.routes.ai import router as ai_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database schema on startup."""
    init_db()
    yield


app = FastAPI(
    title="GreenTrace 2.0 Backend",
    description="Protected off-chain evidence storage and metadata cache for Tezos GreenTrace 2.0",
    version="2.0.0",
    lifespan=lifespan,
)

# Robust CORS Configuration: Avoid wildcard with allow_credentials=True
cors_origins_raw = os.getenv("CORS_ORIGINS", "")
if cors_origins_raw.strip():
    allowed_origins = [o.strip() for o in cors_origins_raw.split(",") if o.strip()]
else:
    allowed_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:4173",
    ]

# If wildcard is explicitly requested, credentials must be False per CORS spec
use_credentials = "*" not in allowed_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=use_credentials,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Mount evidence, activities, reconciliation, public & AI routers
app.include_router(evidence_router)
app.include_router(activities_router)
app.include_router(reconciliation_router)
app.include_router(public_router)
app.include_router(ai_router)


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "GreenTrace 2.0 Backend",
        "supported_network": "Shadownet (Tezos Testnet)",
        "rpc": "https://rpc.shadownet.teztnets.com",
    }
