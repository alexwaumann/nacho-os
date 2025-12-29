import { Check, Loader2, MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { PlaceSuggestion } from "@/server/geo";

import { cn } from "@/lib/utils";
import { getPlaceSuggestions } from "@/server/geo";

interface AddressAutocompleteProps {
  value?: string;
  onSelect: (address: string, placeId: string) => void;
  placeholder?: string;
  className?: string;
  userCoordinates?: { lat: number; lng: number };
  autoFocus?: boolean;
}

export function AddressAutocomplete({
  value,
  onSelect,
  placeholder = "Search for an address...",
  className,
  userCoordinates,
  autoFocus,
}: AddressAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value ?? "");
  const [suggestions, setSuggestions] = useState<Array<PlaceSuggestion>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedValue, setSelectedValue] = useState(value ?? "");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync query with value prop
  useEffect(() => {
    setQuery(value ?? "");
  }, [value]);

  // Handle autoFocus
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setIsLoading(true);
      try {
        const results = await getPlaceSuggestions({
          data: { query, userCoordinates },
        });
        setSuggestions(results);
      } catch (error) {
        console.error("Failed to fetch suggestions:", error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [query, userCoordinates]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (suggestion: PlaceSuggestion) => {
    setSelectedValue(suggestion.label);
    setQuery(suggestion.label);
    onSelect(suggestion.label, suggestion.placeId);
    setOpen(false);
  };

  const showDropdown = open && (suggestions.length > 0 || query.length >= 2);

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
        <MapPin size={20} />
      </div>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!open) setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full h-12 pl-10 pr-10 bg-muted/50 border border-border rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-foreground"
      />
      {isLoading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-popover text-popover-foreground rounded-xl border border-border shadow-lg overflow-hidden">
          {suggestions.length === 0 && query.length >= 2 ?
            <div className="py-6 text-center text-sm text-muted-foreground">
              {isLoading ? "Searching..." : "No addresses found."}
            </div>
          : <div className="max-h-72 overflow-y-auto">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.placeId}
                  type="button"
                  onClick={() => handleSelect(suggestion)}
                  className="w-full flex items-start gap-3 py-3 px-3 text-left hover:bg-muted transition-colors"
                >
                  <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground truncate">
                      {suggestion.mainText ?? suggestion.label}
                    </div>
                    {suggestion.secondaryText && (
                      <div className="text-sm text-muted-foreground truncate">
                        {suggestion.secondaryText}
                      </div>
                    )}
                  </div>
                  {selectedValue === suggestion.label && (
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                  )}
                </button>
              ))}
            </div>
          }
        </div>
      )}
    </div>
  );
}
