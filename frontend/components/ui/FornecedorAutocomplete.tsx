import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Loader2, X } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface FornecedorOption {
  idfornecedor: number;
  nome: string | null;
  nomefantasia: string | null;
}

interface Props {
  value: number | '';
  displayName: string;
  onChange: (fornecedor: FornecedorOption | null) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function FornecedorAutocomplete({ value, displayName, onChange, disabled, placeholder }: Props) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<FornecedorOption[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync display when value/name changes externally (e.g., reset form)
  useEffect(() => {
    if (!isOpen) setQuery(value ? displayName : '');
  }, [value, displayName, isOpen]);

  // Close on outside click, restore input if selection exists
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery(value ? displayName : '');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [value, displayName]);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); setIsOpen(false); return; }
    setLoading(true);
    try {
      const r = await fetch(`/api/fornecedores/options?nome=${encodeURIComponent(q)}`);
      if (r.ok) {
        const data: FornecedorOption[] = await r.json();
        setSuggestions(data.slice(0, 10));
        setIsOpen(true);
        setHighlight(-1);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v);
    if (v === '') { onChange(null); setSuggestions([]); setIsOpen(false); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(v), 300);
  };

  const handleSelect = (f: FornecedorOption) => {
    setQuery(f.nomefantasia || f.nome || '');
    setIsOpen(false);
    setSuggestions([]);
    onChange(f);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight(h => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlight >= 0) handleSelect(suggestions[highlight]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setQuery(value ? displayName : '');
    }
  };

  const handleClear = () => {
    setQuery('');
    onChange(null);
    setSuggestions([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const showNoResults = isOpen && !loading && suggestions.length === 0 && query.length >= 2;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative flex items-center">
        <Search className="absolute left-3 h-4 w-4 text-slate-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          autoComplete="off"
          className={cn(
            'h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-8 text-sm outline-none focus:ring-2 focus:ring-[#B21212]/20',
            disabled && 'bg-slate-50 text-slate-500 cursor-default'
          )}
          placeholder={placeholder ?? 'Digite 2+ caracteres para buscar...'}
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
        />
        <div className="absolute right-2.5 flex items-center">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-[#B21212]" />
          ) : value !== '' && value > 0 && !disabled ? (
            <button type="button" onClick={handleClear} className="text-slate-400 hover:text-slate-600 transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((f, idx) => (
            <li key={f.idfornecedor}>
              <button
                type="button"
                className={cn(
                  'w-full text-left px-3 py-2.5 flex flex-col gap-0.5 hover:bg-red-50/60 transition-colors border-b border-slate-50 last:border-0',
                  idx === highlight && 'bg-red-50/80'
                )}
                onMouseDown={e => { e.preventDefault(); handleSelect(f); }}
                onMouseEnter={() => setHighlight(idx)}
              >
                <span className="text-sm font-semibold text-slate-700">
                  {f.nomefantasia || f.nome || `#${f.idfornecedor}`}
                </span>
                {f.nomefantasia && f.nome && (
                  <span className="text-xs text-slate-400">{f.nome}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {showNoResults && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-4 text-sm text-slate-400 text-center">
          Nenhum fornecedor encontrado para "{query}".
        </div>
      )}
    </div>
  );
}
