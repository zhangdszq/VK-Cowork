import { useState } from "react";

type Chapter = {
  id: string;
  time: string;
  title: string;
};

// Parse chapter list from text
// Matches: "1. [00:00-03:20] Title" or "**1.** [00:00-03:20] Title" (markdown bold)
export function parseChapters(text: string): Chapter[] {
  const chapters: Chapter[] = [];
  const lines = text.split(/\n/);
  
  for (const line of lines) {
    // Match both plain and markdown bold formats:
    // "1. [00:00-05:00] Title" or "**1.** [00:00-05:00] Title"
    const match = line.match(/^\s*\*{0,2}(\d+)\.\*{0,2}\s*\[(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[-–]\s*\d{1,2}:\d{2}(?::\d{2})?)?)\]\s*(.+?)(?:\s*(?:✅|已完成).*)?$/);
    if (match) {
      chapters.push({
        id: match[1],
        time: match[2],
        title: match[3].trim()
      });
    }
  }
  
  return chapters;
}

// Check if text contains a chapter selection prompt
// STRICT: Only match if there are timestamped chapter entries
export function isChapterSelectionText(text: string): boolean {
  // Must have timestamped list entries like "1. [00:00-03:20]" or "**1.** [00:00-03:20]"
  // Pattern matches: number (optionally bold with **) followed by timestamp in brackets
  const timestampPattern = /\*{0,2}\d+\.\*{0,2}\s*\[\d{1,2}:\d{2}/;
  
  if (!timestampPattern.test(text)) {
    return false; // No timestamps = not a chapter list
  }
  
  // Count how many timestamped entries we have
  const matches = text.match(/\*{0,2}\d+\.\*{0,2}\s*\[\d{1,2}:\d{2}/g);
  
  // Need at least 2 timestamped entries to be a chapter list
  return matches !== null && matches.length >= 2;
}

interface ChapterSelectorProps {
  chapters: Chapter[];
  onSubmit: (selectedIds: string[]) => void;
}

export function ChapterSelector({ chapters, onSubmit }: ChapterSelectorProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleChapter = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(chapters.map(c => c.id)));
  };

  const clearAll = () => {
    setSelectedIds(new Set());
  };

  const handleSubmit = () => {
    if (selectedIds.size === 0) return;
    onSubmit(Array.from(selectedIds).sort((a, b) => parseInt(a) - parseInt(b)));
  };

  return (
    <div className="mt-4 rounded-2xl border border-accent/20 bg-accent/5 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-accent">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          选择章节
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">
            已选 {selectedIds.size}/{chapters.length}
          </span>
          <button
            className="text-xs text-accent hover:text-accent-hover"
            onClick={selectAll}
          >
            全选
          </button>
          <button
            className="text-xs text-muted hover:text-ink-700"
            onClick={clearAll}
          >
            清空
          </button>
        </div>
      </div>

      <div className={`grid gap-2 ${chapters.length > 6 ? "max-h-80 overflow-y-auto pr-2" : ""}`}>
        {chapters.map((chapter) => {
          const isSelected = selectedIds.has(chapter.id);
          return (
            <button
              key={chapter.id}
              className={`group relative rounded-xl border px-4 py-3 text-left transition-all duration-150 ${
                isSelected
                  ? "border-accent bg-accent/10 shadow-sm"
                  : "border-ink-900/10 bg-surface hover:border-accent/40 hover:bg-accent/5"
              }`}
              onClick={() => toggleChapter(chapter.id)}
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-5 w-5 items-center justify-center rounded-md border-2 transition-colors ${
                  isSelected 
                    ? "border-accent bg-accent" 
                    : "border-ink-900/20 group-hover:border-accent/50"
                }`}>
                  {isSelected && (
                    <svg viewBox="0 0 24 24" className="h-3 w-3 text-white" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium truncate ${isSelected ? "text-accent" : "text-ink-700"}`}>
                    {chapter.id}. {chapter.title}
                  </div>
                  {chapter.time && (
                    <div className="text-xs text-muted">{chapter.time}</div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-accent/10 flex gap-3">
        <button
          className={`rounded-full px-5 py-2.5 text-sm font-medium text-white shadow-soft transition-all ${
            selectedIds.size > 0
              ? "bg-accent hover:bg-accent-hover active:scale-95"
              : "bg-ink-400/40 cursor-not-allowed"
          }`}
          onClick={handleSubmit}
          disabled={selectedIds.size === 0}
        >
          确认选择 ({selectedIds.size})
        </button>
      </div>
    </div>
  );
}
