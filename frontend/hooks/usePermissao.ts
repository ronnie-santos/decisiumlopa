import { useAuth } from '../context/AuthContext';

export function usePermissao(modulo: string) {
  const { temPermissao } = useAuth();
  return {
    podeVer:      temPermissao(modulo, 'ler'),
    podeCriar:    temPermissao(modulo, 'criar'),
    podeEditar:   temPermissao(modulo, 'editar'),
    podeExcluir:  temPermissao(modulo, 'excluir'),
    podeExportar: temPermissao(modulo, 'exportar'),
  };
}
