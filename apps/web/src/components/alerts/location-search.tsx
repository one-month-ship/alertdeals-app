'use client';

import { searchLocations } from '@/actions/location.actions';
import { cn } from '@/lib/utils';
import type { TLocation } from '@alertdeals/db';
import { ChevronDown, Loader2, MapPin } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type Props = {
  value: TLocation | null;
  onChange: (location: TLocation | null) => void;
};

export function LocationSearch({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TLocation[]>([]);
  const [defaultResults, setDefaultResults] = useState<TLocation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingDefaults, setIsLoadingDefaults] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasLoadedDefaults = useRef(false);

  useEffect(() => {
    if (open && !hasLoadedDefaults.current) {
      hasLoadedDefaults.current = true;
      setIsLoadingDefaults(true);
      searchLocations('')
        .then(setDefaultResults)
        .finally(() => setIsLoadingDefaults(false));
    }
  }, [open]);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        setResults(await searchLocations(query));
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayedResults = query.length >= 2 ? results : defaultResults;

  const handleSelect = (location: TLocation) => {
    onChange(location);
    setQuery('');
    setOpen(false);
  };

  const handleOpen = () => {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const triggerClasses =
    'flex h-9 w-full items-center justify-between rounded-md border border-input bg-input/50 px-3 py-2 text-sm shadow-xs transition-colors hover:bg-accent focus:border-ring focus:outline-none';

  return (
    <div ref={containerRef} className="relative">
      {!open ? (
        <button type="button" onClick={handleOpen} className={triggerClasses}>
          <span className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className={cn(value ? 'text-foreground' : 'text-muted-foreground')}>
              {value
                ? `${value.name} (${value.zipcode})`
                : 'Rechercher une ville ou code postal…'}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      ) : (
        <div className="relative">
          <MapPin className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            placeholder="Rechercher une ville ou code postal…"
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 w-full rounded-md border border-ring bg-input/50 py-2 pr-3 pl-9 text-sm text-foreground placeholder-muted-foreground outline-none"
          />
        </div>
      )}

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md">
          {(isSearching || isLoadingDefaults) && (
            <div className="flex items-center justify-center gap-2 p-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Recherche…
            </div>
          )}

          {!isSearching && !isLoadingDefaults && query.length >= 2 && results.length === 0 && (
            <div className="p-3 text-center text-sm text-muted-foreground">
              Aucun résultat trouvé
            </div>
          )}

          {!isSearching && !isLoadingDefaults && displayedResults.length > 0 && (
            <ul className="max-h-[220px] overflow-y-auto py-1">
              {displayedResults.map((location) => (
                <li
                  key={location.id}
                  onClick={() => handleSelect(location)}
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent"
                >
                  <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                  {location.name} ({location.zipcode})
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
