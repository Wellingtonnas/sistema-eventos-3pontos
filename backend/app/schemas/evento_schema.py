from pydantic import BaseModel
from typing import Optional


class EventoBase(BaseModel):
    nome: str
    endereco: Optional[str]
    mes: int

    periodoInicio: Optional[str]
    periodoFim: Optional[str]

    montInicio: Optional[str]
    montFim: Optional[str]

    desmInicio: Optional[str]
    desmFim: Optional[str]


class EventoCreate(EventoBase):
    pass


class Evento(EventoBase):
    id: int

    class Config:
        orm_mode = True
