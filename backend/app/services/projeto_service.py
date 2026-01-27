from sqlalchemy.orm import Session
from app.repositories import projetos_repository


def listar_projetos_por_evento(db: Session, evento_id: int):
    return projetos_repository.get_by_evento(db, evento_id)


def criar_projeto(db: Session, projeto):
    return projetos_repository.create(db, projeto.dict())
