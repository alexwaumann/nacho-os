import { Check, Loader2, MapPin } from "lucide-react";
import { useEffect, useState } from "react";

import type { PlaceSuggestion } from "@/server/geo";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { getPlaceSuggestions } from "@/server/geo";

interface AddressAutocompleteProps {
  value?: string;
  onSelect: (address: string, placeId: string) => void;
  placeholder?: string;
  className?: string;
  userCoordinates?: { lat: number; lng: number };
}

export function AddressAutocomplete({
  value,
  onSelect,
  placeholder = "Search for an address...",
  className,
  userCoordinates,
}: AddressAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value ?? "");
  const [suggestions, setSuggestions] = useState<Array<PlaceSuggestion>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedValue, setSelectedValue] = useState(value ?? "");

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

  const handleSelect = (suggestion: PlaceSuggestion) => {
    setSelectedValue(suggestion.label);
    setQuery(suggestion.label);
    onSelect(suggestion.label, suggestion.placeId);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className={cn("relative", className)}>
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <MapPin size={20} />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!open) setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="w-full pl-10 pr-10 py-3 bg-muted/50 border border-border rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-foreground"
          />
          {isLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandList>
            <CommandEmpty>
              {query.length < 2 ? "Type to search..." : "No addresses found."}
            </CommandEmpty>
            {suggestions.length > 0 && (
              <CommandGroup>
                {suggestions.map((suggestion) => (
                  <CommandItem
                    key={suggestion.placeId}
                    value={suggestion.placeId}
                    onSelect={() => handleSelect(suggestion)}
                    className="flex items-start gap-3 py-3"
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
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
