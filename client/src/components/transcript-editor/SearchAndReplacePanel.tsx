import { ChevronDown, ChevronUp, Code, Replace, ReplaceAll, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchAndReplacePanelProps {
    searchQuery: string;
    onSearchQueryChange: (value: string) => void;
    replaceQuery: string;
    onReplaceQueryChange: (value: string) => void;
    isRegexSearch: boolean;
    onToggleRegexSearch: () => void;
    currentMatchIndex: number;
    totalMatches: number;
    goToNextMatch: () => void;
    goToPrevMatch: () => void;
    onReplaceCurrent: () => void;
    onReplaceAll: () => void;
    className?: string;
}

export function SearchAndReplacePanel({
    searchQuery,
    onSearchQueryChange,
    replaceQuery,
    onReplaceQueryChange,
    isRegexSearch,
    onToggleRegexSearch,
    currentMatchIndex,
    totalMatches,
    goToNextMatch,
    goToPrevMatch,
    onReplaceCurrent,
    onReplaceAll,
    className,
}: SearchAndReplacePanelProps) {
    const [showReplace, setShowReplace] = useState(false);
    const [localSearch, setLocalSearch] = useState(searchQuery);

    // Sync local search with external query (e.g. if cleared externally)
    useEffect(() => {
        setLocalSearch(searchQuery);
    }, [searchQuery]);

    // Debounce search update to parent
    useEffect(() => {
        const timer = setTimeout(() => {
            if (localSearch !== searchQuery) {
                onSearchQueryChange(localSearch);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [localSearch, searchQuery, onSearchQueryChange]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            if (e.metaKey || e.ctrlKey || e.altKey) {
                onReplaceCurrent();
            } else if (e.shiftKey) {
                goToPrevMatch();
            } else {
                goToNextMatch();
            }
        } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onSearchQueryChange("");
            onReplaceQueryChange("");
            setShowReplace(false);
        } else if (e.altKey) {
            if (e.key.toLowerCase() === "r") {
                e.preventDefault();
                e.stopPropagation();
                onReplaceCurrent();
            } else if (e.key.toLowerCase() === "a") {
                e.preventDefault();
                e.stopPropagation();
                onReplaceAll();
            } else if (e.key.toLowerCase() === "n") {
                e.preventDefault();
                e.stopPropagation();
                goToNextMatch();
            } else if (e.key.toLowerCase() === "p") {
                e.preventDefault();
                e.stopPropagation();
                goToPrevMatch();
            }
        }
    };

    const isValidRegex = (query: string) => {
        if (!query) return true;
        try {
            new RegExp(query);
            return true;
        } catch {
            return false;
        }
    };

    const regexValid = !isRegexSearch || isValidRegex(localSearch);

    return (
        <div className={cn("space-y-2", className)}>
            <div className="relative group/search">
                <div className="absolute left-2.5 top-2.5 text-muted-foreground transition-colors group-focus-within/search:text-foreground">
                    <Search className="h-4 w-4" />
                </div>
                <Input
                    value={localSearch}
                    onChange={(e) => setLocalSearch(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={isRegexSearch ? "Regex search..." : "Search transcript..."}
                    className={cn(
                        "pl-9 pr-24 h-9 text-sm",
                        !regexValid && "border-destructive focus-visible:ring-destructive",
                    )}
                    data-testid="input-search-transcript"
                />
                <div className="absolute right-1 top-1 flex items-center gap-0.5">
                    {localSearch && (
                        <span className="text-[10px] text-muted-foreground px-1 select-none">
                            {totalMatches > 0 ? `${currentMatchIndex + 1}/${totalMatches}` : "0"}
                        </span>
                    )}
                    {localSearch && (
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                                setLocalSearch("");
                                onSearchQueryChange("");
                            }}
                            title="Clear search"
                        >
                            <X className="h-3 w-3" />
                        </Button>
                    )}
                    <Button
                        size="icon"
                        variant={isRegexSearch ? "secondary" : "ghost"}
                        className={cn(
                            "h-7 w-7 transition-colors",
                            isRegexSearch ? "text-primary" : "text-muted-foreground hover:text-foreground",
                        )}
                        onClick={onToggleRegexSearch}
                        title="Toggle Regex Search"
                    >
                        <Code className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        size="icon"
                        variant={showReplace ? "secondary" : "ghost"}
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                            if (showReplace) {
                                onReplaceQueryChange("");
                            }
                            setShowReplace(!showReplace);
                        }}
                        title="Toggle Replace"
                    >
                        <Replace className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            {showReplace && (
                <div className="space-y-2 animate-in slide-in-from-top-1 duration-200">
                    <div className="relative group/replace">
                        <div className="absolute left-2.5 top-2.5 text-muted-foreground">
                            <Replace className="h-4 w-4" />
                        </div>
                        <Input
                            value={replaceQuery}
                            onChange={(e) => onReplaceQueryChange(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Replace with..."
                            className="pl-9 pr-9 h-9 text-sm"
                            data-testid="input-replace-transcript"
                        />
                        {replaceQuery && (
                            <div className="absolute right-1 top-1">
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                    onClick={() => onReplaceQueryChange("")}
                                    title="Clear replace"
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1">
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={goToPrevMatch}
                                disabled={totalMatches === 0}
                                title="Previous match (Shift+Enter / Alt+P)"
                            >
                                <ChevronUp className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={goToNextMatch}
                                disabled={totalMatches === 0}
                                title="Next match (Enter / Alt+N)"
                            >
                                <ChevronDown className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="flex items-center gap-1">
                            <Button
                                variant="secondary"
                                size="sm"
                                className="h-8 text-[11px] px-2"
                                onClick={onReplaceCurrent}
                                disabled={totalMatches === 0}
                                title="Replace current (Alt+R / Alt+Enter)"
                            >
                                Replace
                            </Button>
                            <Button
                                variant="secondary"
                                size="sm"
                                className="h-8 text-[11px] px-2"
                                onClick={onReplaceAll}
                                disabled={totalMatches === 0}
                                title="Replace all (Alt+A)"
                            >
                                <ReplaceAll className="h-3.5 w-3.5 mr-1" />
                                All
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
