from app.database.connection import engine, Base
from app.database.models import evento_model, projeto_model

print("Criando tabelas...")
Base.metadata.create_all(bind=engine)
print("OK.")
