import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, Loader2, X } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface EquipamentoOption {
  idequipamento: number;
  nome: string;
  placa: string | null;
}

interface Props {
  value: number;
  displayName: string;
  onChange: (eq: EquipamentoOption | null) => void;
  disabled?: boolean;
  placeholder?: string;
}

interface DropdownPos { top: number; left: number; width: number }

export function EquipamentoAutocomplete({ value, displayName, onChange, disabled, placeholder }: Props) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<EquipamentoOption[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [dropPos, setDropPos] = useState<DropdownPos | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isOpen) setQuery(value ? displayName : '');
  }, [value, displayName, isOpen]);

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

  // Reposition on scroll/resize so portal stays anchored to input
  useEffect(() => {
    if (!isOpen) return;
    const update = () => {
      if (!inputRef.current) return;
      const r = inputRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX, width: r.width });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [isOpen]);

  const openDropdown = () => {
    if (!inputRef.current) return;
    const r = inputRef.current.getBoundingClientRect();
    setDropPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX, width: r.width });
  };

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); setIsOpen(false); return; }
    setLoading(true);
    try {
      const r = await fetch(`/api/equipamentos?search=${encodeURIComponent(q)}&limit=20`);
      if (r.ok) {
        const data: EquipamentoOption[] = await r.json();
        setSuggestions(data.slice(0, 15));
        openDropdown();
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

  const handleSelect = (eq: EquipamentoOption) => {
    setQuery(eq.placa ? `${eq.nome} — ${eq.placa}` : eq.nome);
    setIsOpen(false);
    setSuggestions([]);
    onChange(eq);
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

  const dropdown = (isOpen && suggestions.length > 0 && dropPos) ? createPortal(
    <ul
      style={{ position: 'absolute', top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 9999 }}
      className="bg-white border border-slate-200 rounded-lg shadow-xl max-h-72 overflow-y-auto"
    >
      {suggestions.map((eq, idx) => (
        <li key={eq.idequipamento}>
          <button
            type="button"
            className={cn(
              'w-full text-left px-3 py-2.5 flex flex-col gap-0.5 hover:bg-red-50/60 transition-colors border-b border-slate-50 last:border-0',
              idx === highlight && 'bg-red-50/80'
            )}
            onMouseDown={e => { e.preventDefault(); handleSelect(eq); }}
            onMouseEnter={() => setHighlight(idx)}
          >
            <span className="text-sm font-semibold text-slate-700">{eq.nome}</span>
            {eq.placa && <span className="text-xs text-slate-400">{eq.placa}</span>}
          </button>
        </li>
      ))}
    </ul>,
    document.body
  ) : null;

  const noResultsDropdown = (showNoResults && dropPos) ? createPortal(
    <div
      style={{ position: 'absolute', top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 9999 }}
      className="bg-white border border-slate-200 rounded-lg shadow-xl px-3 py-4 text-sm text-slate-400 text-center"
    >
      Nenhum equipamento encontrado para "{query}".
    </div>,
    document.body
  ) : null;

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
          ) : value > 0 && !disabled ? (
            <button type="button" onClick={handleClear} className="text-slate-400 hover:text-slate-600 transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>
      {dropdown}
      {noResultsDropdown}
    </div>
  );
}
