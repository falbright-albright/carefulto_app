import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { api, type AddressSuggestion } from "@/lib/api";
import { cn } from "@/lib/utils";

interface AddressAutocompleteProps {
  id?: string;
  value: string;
  placeholder?: string;
  onChange: (text: string) => void;
  onSelect: (suggestion: AddressSuggestion) => void;
}

// Debounced address search-as-you-type, backed by the self-hosted,
// Ontario-only Nominatim instance via /api/geo/autocomplete.
export function AddressAutocomplete({
  id,
  value,
  placeholder,
  onChange,
  onSelect,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (value.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { suggestions } = await api.addressAutocomplete(value);
        setSuggestions(suggestions);
        setOpen(true);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={id}
        placeholder={placeholder}
        value={value}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
      />
      {open && (loading || suggestions.length > 0) && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md">
          {loading && suggestions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">Searching…</div>
          ) : (
            suggestions.map((s, i) => (
              <button
                key={`${s.lat},${s.lng},${i}`}
                type="button"
                className={cn(
                  "block w-full truncate px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                )}
                onClick={() => {
                  onSelect(s);
                  onChange(s.label);
                  setOpen(false);
                  setSuggestions([]);
                }}
              >
                {s.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
