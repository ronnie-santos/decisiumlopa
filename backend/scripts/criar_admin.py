"""
Cria o usuario administrador inicial se nao existir.

Execucao:
    cd backend
    python scripts/criar_admin.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import bcrypt
from sqlalchemy.orm import Session
from database import SessionLocal
import models


def hash_senha(senha: str) -> str:
    return bcrypt.hashpw(senha.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def run():
    db: Session = SessionLocal()
    try:
        existente = db.query(models.Usuario).filter(models.Usuario.username == "admin").first()
        if existente:
            print("Usuario admin ja existe (id={})".format(existente.idusuario))
            return

        perfil = db.query(models.Perfil).filter(models.Perfil.nome == "Administrador").first()
        if not perfil:
            print("[ERRO] Perfil 'Administrador' nao encontrado. Execute migrate_rbac.py primeiro.")
            return

        usuario = models.Usuario(
            nome="Administrador",
            username="admin",
            senha_hash=hash_senha("admin123"),
            idperfil=perfil.idperfil,
            ativo=True,
        )
        db.add(usuario)
        db.commit()
        print("Usuario admin criado com senha: admin123")
    finally:
        db.close()


if __name__ == "__main__":
    run()
