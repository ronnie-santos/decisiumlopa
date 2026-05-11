import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface GridColumn<T> {
  /** Texto do cabeçalho */
  header: string;
  /** Classe CSS extra para o <th> (sobrescreve o padrão) */
  headerClass?: string;
  /** Classe CSS extra para o <td> (sobrescreve o padrão) */
  cellClass?: string;
  /** Conteúdo da célula */
  render: (item: T) => React.ReactNode;
}

interface DataGridProps<T> {
  /** Dados já filtrados/ordenados pela página pai */
  data: T[];
  /** Definição das colunas */
  columns: GridColumn<T>[];
  /** Função que retorna a chave única de cada linha */
  getKey: (item: T) => string | number;
  /** Itens por página — padrão: 50 */
  pageSize?: number;
  /** Texto exibido quando não há registros */
  emptyMessage?: string;
}

// ── Componente ─────────────────────────────────────────────────────────────────

const TH_CLASS =
  'px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest';

export function DataGrid<T>({
  data,
  columns,
  getKey,
  pageSize = 50,
  emptyMessage = 'Nenhum registro encontrado.',
}: DataGridProps<T>) {
  const [page, setPage] = useState(1);

  // Quando os dados mudam (filtro aplicado pelo pai), volta à página 1
  useEffect(() => {
    setPage(1);
  }, [data]);

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  // Garante que a página atual nunca ultrapassa o total (ex: após filtrar)
  const safePage = Math.min(page, totalPages);

  const paged = data.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Números de página com reticências
  const pageNums = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
    .reduce<(number | '...')[]>((acc, p, idx, arr) => {
      if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push('...');
      acc.push(p);
      return acc;
    }, []);

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50/50 border-b border-slate-100">
            {columns.map((col, i) => (
              <th key={i} className={col.headerClass ?? TH_CLASS}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {paged.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-sm text-slate-400"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            paged.map(item => (
              <tr
                key={getKey(item)}
                className="hover:bg-slate-50/50 transition-colors group"
              >
                {columns.map((col, i) => (
                  <td key={i} className={col.cellClass ?? 'px-4 py-2'}>
                    {col.render(item)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* ── Rodapé / Paginação ── */}
      <div className="px-4 py-2 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">
          {data.length === 0
            ? 'Nenhum registro encontrado'
            : `Exibindo ${(safePage - 1) * pageSize + 1}–${Math.min(
                safePage * pageSize,
                data.length
              )} de ${data.length} registro(s)`}
        </span>

        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {pageNums.map((p, idx) =>
              p === '...' ? (
                <span key={`el-${idx}`} className="px-1 text-xs text-slate-400">
                  ...
                </span>
              ) : (
                <Button
                  key={p}
                  variant={p === safePage ? 'default' : 'outline'}
                  className="h-8 w-8 p-0 text-xs font-bold"
                  onClick={() => setPage(p as number)}
                >
                  {p}
                </Button>
              )
            )}

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
