import { useMemo, useState } from 'react';
import { Globe, Search, Check } from 'lucide-react';
import { GLOBAL_JURISDICTIONS, findJurisdiction } from '../data/jurisdictions';

interface JurisdictionSelectorProps {
  value: string;
  onChange: (code: string) => void;
  label?: string;
}

export function JurisdictionSelector({ value, onChange, label }: JurisdictionSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = useMemo(() => findJurisdiction(value), [value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return GLOBAL_JURISDICTIONS.slice(0, 45);
    return GLOBAL_JURISDICTIONS.filter(
      (j) =>
        j.name.toLowerCase().includes(q) ||
        j.code.toLowerCase().includes(q) ||
        j.region.toLowerCase().includes(q) ||
        j.currency.toLowerCase().includes(q)
    ).slice(0, 50);
  }, [query]);

  return (
    <div className="relative">
      {label && (
        <label className="block text-xs font-medium text-zinc-400 mb-1.5">
          {label}
        </label>
      )}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 bg-[#0B0D11] border border-zinc-800 hover:border-zinc-700 rounded-md text-left text-sm text-zinc-100 transition-colors focus-visible:outline-2 focus-visible:outline-amber-500"
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <Globe className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="truncate font-medium">{selected.name}</span>
        </span>
        <span className="font-mono text-xs text-zinc-400 shrink-0 tabular-nums">
          {selected.code} · {(selected.taxRate * 100).toFixed(selected.taxRate % 0.01 === 0 ? 0 : 2)}% {selected.taxType}
        </span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full bg-[#12151C] border border-zinc-800 rounded-md shadow-2xl overflow-hidden">
          <div className="p-2.5 border-b border-zinc-800 flex items-center gap-2">
            <Search className="w-4 h-4 text-zinc-500 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${GLOBAL_JURISDICTIONS.length} countries & tax zones...`}
              autoFocus
              className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
            />
          </div>
          <div className="max-h-60 overflow-y-auto divide-y divide-zinc-800/60">
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-zinc-500">
                No matching jurisdiction found.
              </div>
            ) : (
              filtered.map((item) => {
                const isSelected = item.code === selected.code;
                return (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => {
                      onChange(item.code);
                      setOpen(false);
                      setQuery('');
                    }}
                    className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left text-xs transition-colors ${
                      isSelected
                        ? 'bg-amber-500/10 text-amber-300'
                        : 'text-zinc-300 hover:bg-zinc-800/60'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">{item.name}</div>
                      <div className="text-zinc-500">
                        {item.region} · {item.currency}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 font-mono tabular-nums text-zinc-400">
                      <span>
                        {(item.taxRate * 100).toFixed(item.taxRate % 0.01 === 0 ? 0 : 2)}% {item.taxType}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-amber-500" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
