import { useState, useEffect } from 'react';

interface Cidade {
  idcidade: number;
  nome: string;
  idestado: string;
}

interface Bairro {
  idbairro: number;
  nome: string;
  idcidade: number;
}

/**
 * Hook que carrega cidades e bairros sob demanda (lazy).
 * - cidades são carregadas quando `idestado` muda
 * - bairros são carregados quando `idcidade` muda
 * Evita o carregamento em massa de 10k cidades + 39k bairros na montagem da página.
 */
export function useCidadeBairro(idestado?: string | null, idcidade?: number | null) {
  const [cidades, setCidades] = useState<Cidade[]>([]);
  const [bairros, setBairros] = useState<Bairro[]>([]);

  useEffect(() => {
    if (!idestado) {
      setCidades([]);
      return;
    }
    fetch(`/api/cidades?idestado=${encodeURIComponent(idestado)}`)
      .then(r => r.json())
      .then(d => setCidades(Array.isArray(d) ? d : []))
      .catch(() => setCidades([]));
  }, [idestado]);

  useEffect(() => {
    if (!idcidade) {
      setBairros([]);
      return;
    }
    fetch(`/api/bairros?idcidade=${idcidade}`)
      .then(r => r.json())
      .then(d => setBairros(Array.isArray(d) ? d : []))
      .catch(() => setBairros([]));
  }, [idcidade]);

  return { cidades, bairros };
}
