"""
base_report.py — Layout base de relatórios do Lopa / DECISIUM
Todos os relatórios devem herdar desta classe.

Critérios aplicados:
  - Margem 0,5 cm em todos os lados
  - Nome do relatório: canto superior esquerdo
  - Logo da empresa: canto superior direito (logo_empresa.png)
  - Linha separadora abaixo do cabeçalho
  - Rodapé: data (esquerda) | DECISIUM Software (centro) | página (direita)
  - Cabeçalho de colunas: fundo cinza claro, texto preto, repetido em cada página
  - Dados em colunas estilo planilha (com zebra striping opcional)
"""

import os
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

# ── Constantes visuais ────────────────────────────────────────────────────────
MARGIN          = 0.5 * cm          # margem uniforme 0,5 cm
HEADER_HEIGHT   = 1.8 * cm         # altura reservada para o cabeçalho
FOOTER_HEIGHT   = 0.8 * cm         # altura reservada para o rodapé

COLOR_HEADER_BG = colors.HexColor("#D9D9D9")   # cinza claro para cabeçalho das colunas
COLOR_ROW_ALT   = colors.HexColor("#F5F5F5")   # zebra striping (linha alternada)
COLOR_ROW_MAIN  = colors.white
COLOR_GRID      = colors.HexColor("#CCCCCC")   # cor das bordas da tabela
COLOR_SEP_LINE  = colors.HexColor("#555555")   # linha separadora do título
COLOR_TEXT      = colors.black

FONT_NORMAL     = "Helvetica"
FONT_BOLD       = "Helvetica-Bold"

# Caminho padrão da logo (ajuste conforme seu ambiente de produção)
_DEFAULT_LOGO_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "frontend", "public", "image", "logo_empresa.png"
)


# ── Classe Base ───────────────────────────────────────────────────────────────
class BaseReport:
    """
    Classe base para todos os relatórios do Lopa.

    Parâmetros
    ----------
    title       : str  — Nome do relatório (exibido no canto superior esquerdo)
    orientation : str  — "portrait" ou "landscape"
    logo_path   : str  — Caminho para logo_empresa.png (usa o padrão se omitido)
    zebra       : bool — Ativa/desativa zebra striping nas linhas de dados
    """

    def __init__(
        self,
        title: str,
        orientation: str = "portrait",
        logo_path: str | None = None,
        zebra: bool = True,
    ):
        self.title       = title
        self.orientation = orientation
        self.logo_path   = logo_path or _DEFAULT_LOGO_PATH
        self.zebra       = zebra
        self.pagesize    = landscape(A4) if orientation == "landscape" else A4
        self._styles     = self._build_styles()

    # ── Estilos de parágrafo ──────────────────────────────────────────────────
    def _build_styles(self) -> dict:
        base = getSampleStyleSheet()
        return {
            "title": ParagraphStyle(
                "LopaTitle",
                parent=base["Normal"],
                fontName=FONT_BOLD,
                fontSize=8,
                textColor=COLOR_TEXT,
                leading=10,
            ),
            "cell": ParagraphStyle(
                "LopaCell",
                parent=base["Normal"],
                fontName=FONT_NORMAL,
                fontSize=8,
                textColor=COLOR_TEXT,
                leading=10,
                wordWrap="CJK",
            ),
            "footer": ParagraphStyle(
                "LopaFooter",
                parent=base["Normal"],
                fontName=FONT_NORMAL,
                fontSize=7,
                textColor=COLOR_TEXT,
            ),
        }

    # ── Cabeçalho de página ───────────────────────────────────────────────────
    def _draw_header(self, canvas, doc):
        """Desenha o cabeçalho em cada página: título (esq) + logo (dir) + linha."""
        canvas.saveState()

        page_w, page_h = self.pagesize
        top_y = page_h - MARGIN  # topo da área útil

        # — Nome do relatório (canto superior esquerdo) —
        canvas.setFont(FONT_BOLD, 10)
        canvas.setFillColor(COLOR_TEXT)
        canvas.drawString(MARGIN, top_y - 10, self.title)

        # — Logo da empresa (canto superior direito) —
        logo_w, logo_h = 3.5 * cm, 1.2 * cm
        logo_x = page_w - MARGIN - logo_w
        logo_y = top_y - logo_h

        if os.path.exists(self.logo_path):
            canvas.drawImage(
                self.logo_path,
                logo_x,
                logo_y,
                width=logo_w,
                height=logo_h,
                preserveAspectRatio=True,
                anchor="c",
            )
        else:
            # Fallback: exibe nome da empresa se logo não encontrada
            canvas.setFont(FONT_BOLD, 9)
            canvas.drawRightString(page_w - MARGIN, top_y - 10, "DECISIUM Software")

        # — Linha separadora —
        sep_y = top_y - HEADER_HEIGHT + 0.2 * cm
        canvas.setStrokeColor(COLOR_SEP_LINE)
        canvas.setLineWidth(0.5)
        canvas.line(MARGIN, sep_y, page_w - MARGIN, sep_y)

        canvas.restoreState()

    # ── Rodapé de página ──────────────────────────────────────────────────────
    def _draw_footer(self, canvas, doc):
        """Desenha o rodapé: data (esq) | DECISIUM Software (centro) | página (dir)."""
        canvas.saveState()

        page_w, _ = self.pagesize
        footer_y  = MARGIN + 0.1 * cm

        canvas.setFont(FONT_NORMAL, 7)
        canvas.setFillColor(COLOR_TEXT)

        # Data — esquerda
        date_str = datetime.now().strftime("%d/%m/%Y %H:%M")
        canvas.drawString(MARGIN, footer_y, date_str)

        # DECISIUM Software — centro
        canvas.drawCentredString(page_w / 2, footer_y, "DECISIUM Software")

        # Página X de Y — direita
        page_label = f"Página {doc.page}"
        canvas.drawRightString(page_w - MARGIN, footer_y, page_label)

        canvas.restoreState()

    # ── Callback combinado (header + footer) ──────────────────────────────────
    def _on_page(self, canvas, doc):
        self._draw_header(canvas, doc)
        self._draw_footer(canvas, doc)

    # ── Construtor do documento ───────────────────────────────────────────────
    def _build_doc(self, output_path: str) -> BaseDocTemplate:
        page_w, page_h = self.pagesize

        # Frame começa abaixo do cabeçalho e acima do rodapé
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

        template = PageTemplate(
            id="main",
            frames=[frame],
            onPage=self._on_page,
        )

        doc = BaseDocTemplate(
            output_path,
            pagesize=self.pagesize,
            leftMargin=MARGIN,
            rightMargin=MARGIN,
            topMargin=MARGIN,
            bottomMargin=MARGIN,
        )
        doc.addPageTemplates([template])
        return doc

    # ── Tabela de dados (estilo planilha) ─────────────────────────────────────
    def build_data_table(
        self,
        headers: list[str],
        rows: list[list],
        col_widths: list[float] | None = None,
    ) -> Table:
        """
        Monta uma tabela estilo planilha com:
          - Cabeçalho: fundo cinza claro, texto preto, negrito
          - Dados: zebra striping (linhas alternadas)
          - Grade completa com bordas finas

        Parâmetros
        ----------
        headers    : lista de títulos das colunas
        rows       : lista de linhas (cada linha é uma lista de valores)
        col_widths : larguras das colunas em pontos (None = distribuição automática)
        """
        page_w, _ = self.pagesize
        available_w = page_w - 2 * MARGIN

        if col_widths is None:
            col_widths = [available_w / len(headers)] * len(headers)

        def _cell(value):
            """Todas as células de dados são Paragraph para garantir wrap automático."""
            s = str(value).replace('\n', '<br/>')
            return Paragraph(s, self._styles["cell"])

        # Linha de cabeçalho
        header_row = [
            Paragraph(f"<b>{h}</b>", self._styles["title"]) for h in headers
        ]
        data = [header_row] + [
            [_cell(cell) for cell in row] for row in rows
        ]

        table = Table(data, colWidths=col_widths, repeatRows=1)

        # Estilo base
        style_cmds = [
            # — Cabeçalho —
            ("BACKGROUND",  (0, 0), (-1, 0), COLOR_HEADER_BG),
            ("TEXTCOLOR",   (0, 0), (-1, 0), COLOR_TEXT),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 4),
            ("TOPPADDING",    (0, 0), (-1, 0), 4),
            # — Dados —
            ("TOPPADDING",  (0, 1), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 1), (-1, -1), 3),
            # — Grade —
            ("GRID",        (0, 0), (-1, -1), 0.3, COLOR_GRID),
            ("VALIGN",      (0, 0), (-1, -1), "TOP"),
        ]

        # Zebra striping
        if self.zebra:
            for i, _ in enumerate(rows):
                row_idx = i + 1  # +1 por causa do cabeçalho
                bg = COLOR_ROW_ALT if i % 2 == 1 else COLOR_ROW_MAIN
                style_cmds.append(("BACKGROUND", (0, row_idx), (-1, row_idx), bg))

        table.setStyle(TableStyle(style_cmds))
        return table

    # ── Método principal de geração ───────────────────────────────────────────
    def build(self, elements: list, output_path: str):
        """
        Monta e salva o PDF.

        Parâmetros
        ----------
        elements    : lista de Flowables do ReportLab (Table, Paragraph, Spacer…)
        output_path : caminho de saída do arquivo PDF
        """
        doc = self._build_doc(output_path)
        doc.build(elements)
        return output_path


# ── Exemplo de uso / relatório concreto ──────────────────────────────────────
class ExampleReport(BaseReport):
    """
    Exemplo mínimo de como herdar BaseReport.
    Substitua pelo seu relatório real (EntregasReport, FrotaReport, etc.)
    """

    def __init__(self):
        super().__init__(title="Relatório de Entregas", orientation="landscape")

    def generate(self, data: list[dict], output_path: str) -> str:
        if not data:
            raise ValueError("Nenhum dado para imprimir.")

        headers = list(data[0].keys())
        rows    = [[row[h] for h in headers] for row in data]

        # Larguras proporcionais para paisagem A4
        page_w, _ = landscape(A4)
        available = page_w - 2 * MARGIN
        col_w     = [available / len(headers)] * len(headers)

        elements = [
            self.build_data_table(headers, rows, col_widths=col_w),
            Spacer(1, 0.3 * cm),
        ]

        return self.build(elements, output_path)


# ── Demonstração standalone ───────────────────────────────────────────────────
if __name__ == "__main__":
    sample_data = [
        {"Romaneio": "ROM-001", "Cliente": "Acme Ltda",    "Cidade": "São Paulo",    "Peso (kg)": "120,5", "Status": "Entregue"},
        {"Romaneio": "ROM-002", "Cliente": "Beta S/A",     "Cidade": "Campinas",     "Peso (kg)": "85,0",  "Status": "Trânsito"},
        {"Romaneio": "ROM-003", "Cliente": "Gamma ME",     "Cidade": "Ribeirão Preto","Peso (kg)": "200,0", "Status": "Entregue"},
        {"Romaneio": "ROM-004", "Cliente": "Delta Comércio","Cidade": "Araçatuba",   "Peso (kg)": "55,3",  "Status": "Pendente"},
        {"Romaneio": "ROM-005", "Cliente": "Épsilon Ind.", "Cidade": "Bauru",        "Peso (kg)": "310,8", "Status": "Entregue"},
        {"Romaneio": "ROM-006", "Cliente": "Zeta Log.",    "Cidade": "Marília",      "Peso (kg)": "90,0",  "Status": "Trânsito"},
        {"Romaneio": "ROM-007", "Cliente": "Eta Atacado",  "Cidade": "Presidente Prudente","Peso (kg)": "145,2","Status": "Entregue"},
        {"Romaneio": "ROM-008", "Cliente": "Theta Dist.",  "Cidade": "São José do Rio Preto","Peso (kg)": "270,0","Status": "Cancelado"},
    ]

    report = ExampleReport()
    out    = report.generate(sample_data, "/home/claude/relatorio_demo.pdf")
    print(f"PDF gerado em: {out}")
