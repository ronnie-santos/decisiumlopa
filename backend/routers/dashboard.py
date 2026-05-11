from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from datetime import datetime, timedelta, date as date_type
from typing import List, Dict, Any, Optional
import models
from database import get_db

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

# ── Estatísticas Principais ──────────────────────────────────────────────────────

@router.get("/stats")
def get_dashboard_stats(
    idempresa: Optional[int] = Query(None),
    data_inicio: Optional[date_type] = Query(None),
    data_fim: Optional[date_type] = Query(None),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    try:
        hoje = datetime.now().date()
        ano_atual = hoje.year
        dt_ini = data_inicio or date_type(ano_atual, 1, 1)
        dt_fim = data_fim or hoje

        # Orçamentos aguardando aprovação
        q_orc = db.query(func.count(models.Orcamento.idorcamento)).filter(
            models.Orcamento.situacao == 'AGUARDANDO APROVAÇÃO',
            models.Orcamento.data.between(dt_ini, dt_fim),
        )
        if idempresa:
            q_orc = q_orc.filter(models.Orcamento.idempresa == idempresa)
        orcamentos_abertos = q_orc.scalar() or 0

        # Contas a receber em aberto
        q_cr = db.query(func.sum(models.ContasReceber.valor)).filter(
            models.ContasReceber.situacao == False,
            models.ContasReceber.valor > 0,
            models.ContasReceber.vencimento.between(dt_ini, dt_fim),
        )
        if idempresa:
            q_cr = q_cr.join(
                models.Fechamento,
                models.ContasReceber.idfechamento == models.Fechamento.idfechamento,
            ).filter(models.Fechamento.idempresa == idempresa)
        contas_receber_aberto = q_cr.scalar() or 0

        # Contas a pagar em aberto
        q_cp = db.query(func.sum(models.ContasPagar.valor)).filter(
            models.ContasPagar.situacao == False,
            models.ContasPagar.valor > 0,
            models.ContasPagar.vencimento.between(dt_ini, dt_fim),
        )
        if idempresa:
            q_cp = q_cp.join(
                models.Compra,
                models.ContasPagar.idcompras == models.Compra.idcompras,
            ).filter(models.Compra.idempresa == idempresa)
        contas_pagar_aberto = q_cp.scalar() or 0

        # OS sem fechamento
        q_os = db.query(func.count(models.Ordem.idordem)).filter(
            models.Ordem.situacao == False,
            models.Ordem.idfechamento == None,
            models.Ordem.data.between(dt_ini, dt_fim),
        )
        if idempresa:
            q_os = q_os.filter(models.Ordem.idempresa == idempresa)
        os_aberta = q_os.scalar() or 0

        return {
            'orcamentos_abertos': orcamentos_abertos,
            'contas_receber_aberto': float(contas_receber_aberto) if contas_receber_aberto else 0,
            'contas_pagar_aberto': float(contas_pagar_aberto) if contas_pagar_aberto else 0,
            'os_aberta': os_aberta,
        }
    except Exception as e:
        print(f"Erro ao obter stats: {e}")
        return {
            'orcamentos_abertos': 0,
            'contas_receber_aberto': 0,
            'contas_pagar_aberto': 0,
            'os_aberta': 0,
        }

@router.get("/receita-mensal")
def get_receita_mensal(
    idempresa: Optional[int] = Query(None),
    data_inicio: Optional[date_type] = Query(None),
    data_fim: Optional[date_type] = Query(None),
    db: Session = Depends(get_db),
) -> Dict[str, List[Dict[str, Any]]]:
    try:
        hoje = datetime.now().date()
        ano_atual = hoje.year
        dt_ini = data_inicio or date_type(ano_atual, 1, 1)
        dt_fim = data_fim or hoje

        # Contas a receber por mês
        q_cr = db.query(
            extract('month', models.ContasReceber.vencimento).label('mes'),
            func.sum(models.ContasReceber.valor).label('total')
        ).filter(
            models.ContasReceber.vencimento != None,
            models.ContasReceber.vencimento.between(dt_ini, dt_fim),
        )
        if idempresa:
            q_cr = q_cr.join(
                models.Fechamento,
                models.ContasReceber.idfechamento == models.Fechamento.idfechamento,
            ).filter(models.Fechamento.idempresa == idempresa)
        receita_por_mes = q_cr.group_by('mes').all()

        # Contas a pagar por mês
        q_cp = db.query(
            extract('month', models.ContasPagar.vencimento).label('mes'),
            func.sum(models.ContasPagar.valor).label('total')
        ).filter(
            models.ContasPagar.vencimento != None,
            models.ContasPagar.vencimento.between(dt_ini, dt_fim),
        )
        if idempresa:
            q_cp = q_cp.join(
                models.Compra,
                models.ContasPagar.idcompras == models.Compra.idcompras,
            ).filter(models.Compra.idempresa == idempresa)
        despesa_por_mes = q_cp.group_by('mes').all()

        receita = {i: 0 for i in range(1, 13)}
        despesa = {i: 0 for i in range(1, 13)}

        for mes, total in receita_por_mes:
            if mes:
                receita[int(mes)] = float(total) if total else 0

        for mes, total in despesa_por_mes:
            if mes:
                despesa[int(mes)] = float(total) if total else 0

        return {
            'contas_receber': [{'mes': i, 'valor': receita[i]} for i in range(1, 13)],
            'contas_pagar': [{'mes': i, 'valor': despesa[i]} for i in range(1, 13)],
        }
    except Exception as e:
        print(f"Erro ao obter receita mensal: {e}")
        return {
            'contas_receber': [{'mes': i, 'valor': 0} for i in range(1, 13)],
            'contas_pagar': [{'mes': i, 'valor': 0} for i in range(1, 13)],
        }

# ── Atividades Recentes ──────────────────────────────────────────────────────────

@router.get("/atividades-recentes")
def get_atividades_recentes(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Retorna atividades recentes: aniversariantes, vencimentos de documentos, etc."""
    try:
        hoje = datetime.now().date()
        mes_atual = hoje.month
        proximos_90_dias = hoje + timedelta(days=90)

        atividades = {
            'licencas_vencimento': [],
            'aniversariantes': [],
            'cnh_vencimento': [],
            'exame_medico_vencimento': [],
            'exame_toxicologico_vencimento': []
        }

        # 0. Licenças com vencimento em até 60 dias
        proximos_60_dias = hoje + timedelta(days=60)
        licencas = db.query(models.Licenca, models.Equipamento).outerjoin(
            models.Equipamento, models.Licenca.idequipamento == models.Equipamento.idequipamento
        ).filter(
            models.Licenca.vencimento != None,
            models.Licenca.vencimento >= hoje,
            models.Licenca.vencimento <= proximos_60_dias
        ).all()

        for licenca, equipamento in licencas:
            dias_para_vencer = (licenca.vencimento - hoje).days
            atividades['licencas_vencimento'].append({
                'autorizacao': licenca.autorizacao,
                'equipamento': equipamento.nome if equipamento else None,
                'vencimento': licenca.vencimento.strftime('%d/%m/%Y'),
                'dias_para_vencer': dias_para_vencer,
                'idlicenca': licenca.idlicenca
            })
        atividades['licencas_vencimento'].sort(key=lambda x: x['dias_para_vencer'])

        # Funcionários ativos
        funcionarios_ativos = db.query(models.Funcionario).filter(
            models.Funcionario.demissao == None
        ).all()

        # 1. Aniversariantes do mês
        for func in funcionarios_ativos:
            if func.nascimento and func.nascimento.month == mes_atual:
                atividades['aniversariantes'].append({
                    'nome': func.nome,
                    'dia': func.nascimento.day,
                    'idfuncionario': func.idfuncionario
                })

        # 2. CNH com vencimento em 90 dias
        for func in funcionarios_ativos:
            if func.validade_cnh and hoje <= func.validade_cnh <= proximos_90_dias:
                dias_para_vencer = (func.validade_cnh - hoje).days
                atividades['cnh_vencimento'].append({
                    'nome': func.nome,
                    'vencimento': func.validade_cnh.strftime('%d/%m/%Y'),
                    'dias_para_vencer': dias_para_vencer,
                    'idfuncionario': func.idfuncionario
                })

        # 3. Exame médico com vencimento em 90 dias
        for func in funcionarios_ativos:
            if func.validade_exame and hoje <= func.validade_exame <= proximos_90_dias:
                dias_para_vencer = (func.validade_exame - hoje).days
                atividades['exame_medico_vencimento'].append({
                    'nome': func.nome,
                    'vencimento': func.validade_exame.strftime('%d/%m/%Y'),
                    'dias_para_vencer': dias_para_vencer,
                    'idfuncionario': func.idfuncionario
                })

        # 4. Exame toxicológico com vencimento em 90 dias
        for func in funcionarios_ativos:
            if func.data_toxicologico and hoje <= func.data_toxicologico <= proximos_90_dias:
                dias_para_vencer = (func.data_toxicologico - hoje).days
                atividades['exame_toxicologico_vencimento'].append({
                    'nome': func.nome,
                    'vencimento': func.data_toxicologico.strftime('%d/%m/%Y'),
                    'dias_para_vencer': dias_para_vencer,
                    'idfuncionario': func.idfuncionario
                })

        atividades['aniversariantes'].sort(key=lambda x: x['dia'])
        atividades['cnh_vencimento'].sort(key=lambda x: x['dias_para_vencer'])
        atividades['exame_medico_vencimento'].sort(key=lambda x: x['dias_para_vencer'])
        atividades['exame_toxicologico_vencimento'].sort(key=lambda x: x['dias_para_vencer'])

        return atividades
    except Exception as e:
        print(f"Erro ao obter atividades recentes: {e}")
        return {
            'licencas_vencimento': [],
            'aniversariantes': [],
            'cnh_vencimento': [],
            'exame_medico_vencimento': [],
            'exame_toxicologico_vencimento': []
        }
