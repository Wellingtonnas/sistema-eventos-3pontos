# app/api/projetos_router.py
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
import os

from app.database.connection import get_db
from app.database.models.projeto_model import Projeto as ProjetoModel
from app.schemas.projeto_schema import Projeto, ProjetoCreate
from app.core.deps import get_current_user, require_role

router = APIRouter()

def _get_by_evento(db: Session, evento_id:int):
    return db.query(ProjetoModel).filter(ProjetoModel.evento_id==evento_id).all()

def _get(db: Session, id:int):
    return db.query(ProjetoModel).filter(ProjetoModel.id==id).first()

def _create(db: Session, data:dict):
    p = ProjetoModel(**data)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p

def _update(db: Session, id:int, payload:dict):
    p = _get(db, id)
    if not p: return None
    for k,v in payload.items(): setattr(p,k,v)
    db.commit()
    db.refresh(p)
    return p

def _delete(db: Session, id:int):
    p = _get(db, id)
    if not p: return False
    db.delete(p)
    db.commit()
    return True

@router.get("/evento/{evento_id}", response_model=List[Projeto])
def listar_por_evento(evento_id:int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    return _get_by_evento(db, evento_id)

@router.post("/", response_model=Projeto, dependencies=[Depends(require_role("admin"))])
def criar_projeto(projeto: ProjetoCreate, db: Session = Depends(get_db)):
    payload = projeto.dict()
    return _create(db, payload)

@router.put("/{id}", response_model=Projeto, dependencies=[Depends(require_role("admin"))])
def atualizar_projeto(id:int, projeto: ProjetoCreate, db: Session = Depends(get_db)):
    p = _update(db, id, projeto.dict())
    if not p:
        raise HTTPException(404, "Projeto não encontrado")
    return p

@router.delete("/{id}", dependencies=[Depends(require_role("admin"))])
def apagar_projeto(id:int, db: Session = Depends(get_db)):
    ok = _delete(db, id)
    if not ok:
        raise HTTPException(404, "Projeto não encontrado")
    return {"deleted": True}
