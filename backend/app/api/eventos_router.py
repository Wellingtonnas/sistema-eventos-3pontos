# app/api/eventos_router.py
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
import os
from typing import List
from app.database.connection import get_db
from app.schemas.evento_schema import Evento, EventoCreate
from app.core.deps import require_role, get_current_user
from app.database.models.evento_model import Evento as EventoModel
from app.database.connection import SessionLocal
from app.database.connection import Base, engine

router = APIRouter()

# simples helpers DB direto (mantive simples para Fase1)
def _get_all(db: Session):
    return db.query(EventoModel).all()

def _get(db: Session, id:int):
    return db.query(EventoModel).filter(EventoModel.id==id).first()

def _create(db: Session, data:dict):
    ev = EventoModel(**data)
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return ev

def _update(db: Session, id:int, payload:dict):
    ev = _get(db, id)
    if not ev: return None
    for k,v in payload.items(): setattr(ev, k, v)
    db.commit()
    db.refresh(ev)
    return ev

def _delete(db: Session, id:int):
    ev = _get(db, id)
    if not ev: return False
    db.delete(ev)
    db.commit()
    return True

@router.get("/", response_model=List[Evento])
def listar(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return _get_all(db)

@router.get("/{id}", response_model=Evento)
def buscar(id:int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    ev = _get(db, id)
    if not ev:
        raise HTTPException(404, "Evento não encontrado")
    return ev

@router.post("/", response_model=Evento, dependencies=[Depends(require_role("admin"))])
def criar(evento: EventoCreate, db: Session = Depends(get_db)):
    payload = evento.dict()
    payload.setdefault("historico", "[]")
    ev = _create(db, payload)
    return ev

@router.put("/{id}", response_model=Evento, dependencies=[Depends(require_role("admin"))])
def atualizar(id:int, evento: EventoCreate, db: Session = Depends(get_db)):
    ev = _update(db, id, evento.dict())
    if not ev:
        raise HTTPException(404, "Evento não encontrado")
    return ev

@router.delete("/{id}", dependencies=[Depends(require_role("admin"))])
def remover(id:int, db: Session = Depends(get_db)):
    ok = _delete(db, id)
    if not ok:
        raise HTTPException(404, "Evento não encontrado")
    return {"deleted": True}

# Upload PDF (apenas admin)
@router.post("/{id}/upload", dependencies=[Depends(require_role("admin"))])
def upload_pdf(id:int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    ev = _get(db, id)
    if not ev:
        raise HTTPException(404, "Evento não encontrado")
    fname = f"evt_{id}_{int(__import__('time').time())}_{file.filename}"
    dest = os.path.join("uploads", fname)
    with open(dest, "wb") as f:
        f.write(file.file.read())
    ev.pdf = f"/uploads/{fname}"
    db.commit()
    db.refresh(ev)
    return {"url": ev.pdf}
