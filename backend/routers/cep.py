from fastapi import APIRouter, HTTPException
from util import buscar_cep

router = APIRouter(prefix="/cep", tags=["cep"])


@router.get("/{cep}")
def get_cep(cep: str):
    data = buscar_cep(cep)
    if not data:
        raise HTTPException(status_code=404, detail="CEP não encontrado ou inválido")
    return data
