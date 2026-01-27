# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import eventos_router, projetos_router, auth_router

app = FastAPI(title="Sistema Cronograma - API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True
)

app.include_router(auth_router.router, prefix="/auth", tags=["auth"])
app.include_router(eventos_router.router, prefix="/eventos", tags=["eventos"])
app.include_router(projetos_router.router, prefix="/projetos", tags=["projetos"])

# Servir uploads (PDFs)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

@app.get("/")
def root():
    return {"ok": True}
