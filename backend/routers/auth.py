from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from database import get_db
import models, schemas
from core.security import verificar_senha, criar_access_token, criar_refresh_token, decodificar_token
from core.deps import get_usuario_atual

router = APIRouter(prefix="/auth", tags=["auth"])


def _montar_permissoes(usuario: models.Usuario) -> dict:
    if not usuario.perfil_rel:
        return {}
    return {
        p.modulo_rel.codigo: {
            "ler": p.pode_ler,
            "criar": p.pode_criar,
            "editar": p.pode_editar,
            "excluir": p.pode_excluir,
            "exportar": p.pode_exportar,
        }
        for p in usuario.perfil_rel.permissoes
        if p.modulo_rel
    }


def _token_response(usuario: models.Usuario) -> schemas.TokenResponse:
    payload = {"sub": str(usuario.idusuario), "username": usuario.username}
    return schemas.TokenResponse(
        access_token=criar_access_token(payload),
        refresh_token=criar_refresh_token(payload),
        usuario=schemas.UsuarioLogadoSchema(
            id=usuario.idusuario,
            username=usuario.username,
            nome=usuario.nome,
            perfil=usuario.perfil_rel.nome if usuario.perfil_rel else "",
            permissoes=_montar_permissoes(usuario),
        ),
    )


@router.post("/login", response_model=schemas.TokenResponse)
def login(body: schemas.LoginRequest, db: Session = Depends(get_db)):
    usuario = db.query(models.Usuario).filter(models.Usuario.username == body.username).first()

    if not usuario or not verificar_senha(body.senha, usuario.senha_hash):
        raise HTTPException(status_code=401, detail="Usuario ou senha invalidos")

    if not usuario.ativo:
        raise HTTPException(status_code=403, detail="Usuario inativo. Contate o administrador")

    usuario.ultimo_acesso = datetime.utcnow()
    db.commit()
    db.refresh(usuario)

    return _token_response(usuario)


@router.post("/refresh", response_model=schemas.TokenResponse)
def refresh(body: schemas.RefreshRequest, db: Session = Depends(get_db)):
    try:
        payload = decodificar_token(body.refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Token de refresh invalido")
        usuario_id = int(payload.get("sub"))
    except Exception:
        raise HTTPException(status_code=401, detail="Token invalido ou expirado")

    usuario = db.query(models.Usuario).filter(
        models.Usuario.idusuario == usuario_id,
        models.Usuario.ativo == True,
    ).first()
    if not usuario:
        raise HTTPException(status_code=401, detail="Usuario nao encontrado ou inativo")

    return _token_response(usuario)


@router.get("/me", response_model=schemas.UsuarioLogadoSchema)
def me(usuario: models.Usuario = Depends(get_usuario_atual)):
    return schemas.UsuarioLogadoSchema(
        id=usuario.idusuario,
        username=usuario.username,
        nome=usuario.nome,
        perfil=usuario.perfil_rel.nome if usuario.perfil_rel else "",
        permissoes=_montar_permissoes(usuario),
    )


@router.post("/logout")
def logout():
    return {"mensagem": "Logout realizado com sucesso"}
