from pydantic import BaseModel
from typing import Optional


class ProjetoBase(BaseModel):
    nome: str

    vendedor: Optional[str]
    projetista: Optional[str]

    status: Optional[str]
    operacional: Optional[str]
    impressao: Optional[str]
    cortes: Optional[str]
    eletrica: Optional[str]
    serralharia: Optional[str]


class ProjetoCreate(ProjetoBase):
    evento_id: int


class Projeto(ProjetoBase):
    id: int

    class Config:
        orm_mode = True
