from sqlalchemy.orm import Session
from app.database.models.projeto_model import Projeto


def get_by_evento(db: Session, evento_id: int):
    return db.query(Projeto).filter(Projeto.evento_id == evento_id).all()


def create(db: Session, data):
    novo = Projeto(**data)
    db.add(novo)
    db.commit()
    db.refresh(novo)
    return novo
