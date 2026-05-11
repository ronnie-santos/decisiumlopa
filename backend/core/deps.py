from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import JWTError
from core.security import decodificar_token
from database import get_db
import models

security = HTTPBearer()


def get_usuario_atual(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> models.Usuario:
    token = credentials.credentials
    try:
        payload = decodificar_token(token)
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Token invalido")
        usuario_id: int = int(payload.get("sub"))
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalido ou expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    usuario = db.query(models.Usuario).filter(models.Usuario.idusuario == usuario_id).first()
    if not usuario or not usuario.ativo:
        raise HTTPException(status_code=401, detail="Usuario inativo ou nao encontrado")
    return usuario


def requer_permissao(modulo: str, acao: str = "ler"):
    def dependency(usuario: models.Usuario = Depends(get_usuario_atual)):
        if not usuario.perfil_rel:
            raise HTTPException(status_code=403, detail=f"Sem perfil atribuido")
        modulo_perm = next(
            (p for p in usuario.perfil_rel.permissoes if p.modulo_rel.codigo == modulo),
            None,
        )
        if not modulo_perm:
            raise HTTPException(status_code=403, detail=f"Sem acesso ao modulo {modulo}")
        if not getattr(modulo_perm, f"pode_{acao}", False):
            raise HTTPException(status_code=403, detail=f"Sem permissao para {acao} em {modulo}")
        return usuario
    return dependency
