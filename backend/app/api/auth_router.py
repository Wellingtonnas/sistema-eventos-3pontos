from fastapi import APIRouter

router = APIRouter()


@router.get("/check")
def check():
    return {"auth": "ok"}
# app/api/auth_router.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.core.security import verify_password, create_access_token, get_password_hash
from typing import Dict

router = APIRouter()

# usuários inicia
# is (nome -> {passwordHash, role})
# senhas já especificadas (ex.: alex123) serão transformadas em hash aqui
_initial_users = {
    "ALEXANDRE": {"password": "alex123", "role": "admin"},
    "LUCIANA": {"password": "luciana123", "role": "admin"},
    "VALERIA": {"password": "valeria123", "role": "admin"},
    "HUGO": {"password": "hugo123", "role": "admin"},
    "JOAO": {"password": "joao123", "role": "admin"},
    "MAURO": {"password": "mauro123", "role": "producao"}
}

# hashed users store
USERS: Dict[str, Dict] = {}
for u, v in _initial_users.items():
    USERS[u] = {
        "password_hash": get_password_hash(v["password"]),
        "role": v["role"]
    }

class LoginIn(BaseModel):
    username: str
    password: str

class TokenOut(BaseModel):
    access_token: str
    token_type: str

@router.post("/login", response_model=TokenOut)
def login(data: LoginIn):
    username = data.username.strip().upper()
    if username not in USERS:
        raise HTTPException(status_code=401, detail="Usuário ou senha inválidos")
    user = USERS[username]
    if not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Usuário ou senha inválidos")

    # payload: usuário e role
    token = create_access_token({"sub": username, "role": user["role"]})
    return {"access_token": token, "token_type": "bearer"}

# rota para leitura simples
@router.get("/me")
def me():
    return {"msg":"endpoint público (use /login para obter token)"}
