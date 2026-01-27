from sqlalchemy.orm import Session
from app.repositories import eventos_repository


def listar_eventos(db: Session):
    return eventos_repository.get_all(db)


def criar_evento(db: Session, evento):
    return eventos_repository.create(db, evento.dict())
