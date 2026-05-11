"""
util.py — Utilitários gerais do backend Decisium Lopa
"""

import re
import httpx


def buscar_cep(cep: str) -> dict | None:
    """
    Consulta o endereço completo de um CEP via API ViaCEP.

    Args:
        cep: CEP no formato "16013-180" ou "16013180" (traço opcional)

    Returns:
        Dict com os dados do endereço, ou None se o CEP for inválido/não encontrado.

    Exemplo de retorno:
        {
            "cep": "16013-180",
            "logradouro": "Rua Silva Grota",
            "complemento": "",
            "bairro": "Vila Mendonça",
            "localidade": "Araçatuba",
            "uf": "SP",
            "estado": "São Paulo",
            "ibge": "3502802",
            "ddd": "18",
            ...
        }
    """
    cep_limpo = re.sub(r"\D", "", cep)

    if len(cep_limpo) != 8:
        return None

    url = f"https://viacep.com.br/ws/{cep_limpo}/json/"

    try:
        with httpx.Client(timeout=5.0) as client:
            response = client.get(url)
            response.raise_for_status()
            data = response.json()

            if data.get("erro"):
                return None

            return data

    except (httpx.HTTPError, httpx.TimeoutException, ValueError):
        return None
