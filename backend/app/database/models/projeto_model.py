from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.database.connection import Base

class Projeto(Base):
    __tablename__ = "projetos"

    id = Column(Integer, primary_key=True, index=True)

    evento_id = Column(Integer, ForeignKey("eventos.id"))

    nome = Column(String, nullable=False)

    vendedor = Column(String, nullable=True)
    projetista = Column(String, nullable=True)

    status = Column(String, nullable=True)
    operacional = Column(String, nullable=True)
    impressao = Column(String, nullable=True)
    cortes = Column(String, nullable=True)
    eletrica = Column(String, nullable=True)
    serralharia = Column(String, nullable=True)

    pdf = Column(String, nullable=True)

    statusHist = Column(String, nullable=True)
    operacionalHist = Column(String, nullable=True)
    impressaoHist = Column(String, nullable=True)
    cortesHist = Column(String, nullable=True)
    eletricaHist = Column(String, nullable=True)
    serralhariaHist = Column(String, nullable=True)

    evento = relationship("Evento", back_populates="projetos")
