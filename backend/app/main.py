from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Ocean 3D Platform API",
    description="Backend API for the Ocean 3D visualization platform",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "ok"}


# Include routers from api modules
# from app.api import model_field, observations, comparison, anomalies
# app.include_router(model_field.router)
# app.include_router(observations.router)
# app.include_router(comparison.router)
# app.include_router(anomalies.router)
