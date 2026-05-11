"""
cliente_report.py — Relatório de Listagem de Clientes
Herda BaseReport para layout padrão (cabeçalho, rodapé, tabela).
Orientação: landscape A4 — colunas: #, Nome/Fantasia, CNPJ/CPF, IE/RG, Endereço, Contatos, Status
"""

from io import BytesIO

from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate, Spacer
from reportlab.lib.units import cm

from reports.base_report import BaseReport, MARGIN, HEADER_HEIGHT, FOOTER_HEIGHT


class ClienteReport(BaseReport):
    """Relatório de listagem de clientes em formato de tabela — landscape A4."""

    def __init__(self):
        super().__init__(title="RELATÓRIO DE CLIENTES", orientation="landscape")

    def _col_widths(self):
        page_w, _ = self.pagesize
        w = page_w - 2 * MARGIN
        return [
            w * 0.04,   # #
            w * 0.22,   # Nome / Fantasia
            w * 0.13,   # CNPJ / CPF
            w * 0.11,   # IE / RG
            w * 0.26,   # Endereço
            w * 0.17,   # Contatos
            w * 0.07,   # Status
        ]

    def generate(self, rows: list[list], buf: BytesIO) -> None:
        """
        Gera o PDF no buffer fornecido.

        Parâmetros
        ----------
        rows : lista de linhas com 7 colunas cada:
               [#, Nome/Fantasia, CNPJ/CPF, IE/RG, Endereço, Contatos, Status]
        buf  : BytesIO para escrita do PDF
        """
        headers = ["#", "Nome / Fantasia", "CNPJ / CPF", "IE / RG", "Endereço", "Contatos", "Status"]

        table = self.build_data_table(headers, rows, col_widths=self._col_widths())

        page_w, page_h = self.pagesize
        frame = Frame(
            x1=MARGIN,
            y1=MARGIN + FOOTER_HEIGHT,
            width=page_w - 2 * MARGIN,
            height=page_h - 2 * MARGIN - HEADER_HEIGHT - FOOTER_HEIGHT,
            leftPadding=0,
            rightPadding=0,
            topPadding=4,
            bottomPadding=4,
        )
        template = PageTemplate(id="main", frames=[frame], onPage=self._on_page)

        doc = BaseDocTemplate(
            buf,
            pagesize=self.pagesize,
            leftMargin=MARGIN,
            rightMargin=MARGIN,
            topMargin=MARGIN,
            bottomMargin=MARGIN,
        )
        doc.addPageTemplates([template])
        doc.build([table, Spacer(1, 0.3 * cm)])
