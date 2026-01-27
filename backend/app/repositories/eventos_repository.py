from sqlalchemy.orm import Session
from app.database.models.evento_model import Evento


def get_all(db: Session):
    return db.query(Evento).all()


def get_by_id(db: Session, id: int):
    return db.query(Evento).filter(Evento.id == id).first()


def create(db: Session, data):
    novo = Evento(**data)
    db.add(novo)
    db.commit()
    db.refresh(novo)
    return novo
