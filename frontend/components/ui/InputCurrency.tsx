import React, { useState } from 'react';
import { cn } from '../../utils/cn';

interface InputCurrencyProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type'> {
  label?: string;
  error?: string;
  value: number | string;
  onChange: (value: number) => void;
}

export const InputCurrency = React.forwardRef<HTMLInputElement, InputCurrencyProps>(
  ({ className, label, error, value, onChange, ...props }, ref) => {
    const [isEditing, setIsEditing] = useState(false);
    const [inputValue, setInputValue] = useState('');

    const formatForDisplay = (num: number): string => {
      return num.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    };

    const handleFocus = () => {
      setIsEditing(true);
      // Se o valor é um número, converte para string sem formatação
      if (typeof value === 'number') {
        setInputValue(value.toString().replace('.', ','));
      } else {
        setInputValue(value as string);
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let input = e.target.value;

      // Remove espaços
      input = input.trim();

      // Se vazio, permite
      if (input === '') {
        setInputValue('');
        return;
      }

      // Substitui ponto por vírgula (padrão brasileiro)
      input = input.replace(/\./g, ',');

      // Remove caracteres inválidos (mantém apenas números e vírgula)
      input = input.replace(/[^\d,]/g, '');

      // Garante que não haja mais de uma vírgula
      const parts = input.split(',');
      if (parts.length > 2) {
        input = parts[0] + ',' + parts.slice(1).join('');
      }

      // Limita a parte decimal a 2 dígitos
      if (parts.length === 2) {
        const decimalPart = parts[1].substring(0, 2);
        input = parts[0] + ',' + decimalPart;
      }

      setInputValue(input);
    };

    const handleBlur = () => {
      setIsEditing(false);

      // Se o input estiver vazio, define como 0
      if (inputValue === '' || inputValue === ',') {
        onChange(0);
        setInputValue('');
        return;
      }

      // Converte a string de entrada para número
      let numValue = 0;
      const [intPart, decPart = '00'] = inputValue.split(',');
      const cleanInt = intPart.replace(/[^\d]/g, '') || '0';
      numValue = parseFloat(cleanInt + '.' + decPart.padEnd(2, '0'));

      onChange(numValue);
    };

    // Valor exibido
    let displayValue = '';
    if (isEditing) {
      displayValue = inputValue;
    } else {
      displayValue = typeof value === 'number' ? formatForDisplay(value) : '';
    }

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {label}
          </label>
        )}
        <input
          ref={ref}
          type="text"
          inputMode="decimal"
          className={cn(
            'flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B21212] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-red-500 focus-visible:ring-red-500',
            className
          )}
          onFocus={handleFocus}
          onChange={handleChange}
          onBlur={handleBlur}
          value={displayValue}
          {...props}
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }
);

InputCurrency.displayName = 'InputCurrency';
