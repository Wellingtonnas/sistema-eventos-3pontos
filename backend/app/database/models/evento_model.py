from sqlalchemy import Column, Integer, String, Boolean
from sqlalchemy.orm import relationship
from app.database.connection import Base

class Evento(Base):
    __tablename__ = "eventos"

    id = Column(Integer, primary_key=True, index=True)

    nome = Column(String, nullable=False)
    endereco = Column(String, nullable=True)
    mes = Column(Integer, nullable=False)

    periodoInicio = Column(String, nullable=True)
    periodoFim = Column(String, nullable=True)

    montInicio = Column(String, nullable=True)
    montFim = Column(String, nullable=True)

    desmInicio = Column(String, nullable=True)
    desmFim = Column(String, nullable=True)

    pdf = Column(String, nullable=True)

    cancelado = Column(Boolean, default=False)
    oficial = Column(Boolean, default=False)
    naoOficial = Column(Boolean, default=False)

    historico = Column(String, nullable=True)  # será JSON serializado

    projetos = relationship("Projeto", back_populates="evento")
