from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
import models

router = APIRouter(prefix="/test", tags=["test"])

@router.get("/ping")
def ping():
    return {"status": "ok", "message": "Backend is working!"}

@router.get("/debug")
def debug(db: Session = Depends(get_db)):
    """Endpoint para debug"""
    try:
        # Testa conexão com banco
        count_orcamento = db.query(models.Orcamento).count()
        count_contas_receber = db.query(models.ContasReceber).count()
        count_contas_pagar = db.query(models.ContasPagar).count()
        count_ordem = db.query(models.Ordem).count()

        return {
            "status": "ok",
            "database": "connected",
            "orcamentos": count_orcamento,
            "contas_receber": count_contas_receber,
            "contas_pagar": count_contas_pagar,
            "ordens": count_ordem
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }
