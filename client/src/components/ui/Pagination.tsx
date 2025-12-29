import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  total?: number;
  limit?: number;
}

export default function Pagination({
  page,
  totalPages,
  onPageChange,
  total,
  limit,
}: PaginationProps) {
  const pages = [];
  const maxVisible = 5;

  let start = Math.max(1, page - Math.floor(maxVisible / 2));
  const end = Math.min(totalPages, start + maxVisible - 1);

  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1);
  }

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700">
      <div className="text-sm text-slate-400">
        {total !== undefined && limit !== undefined && (
          <span>
            Zeige {Math.min((page - 1) * limit + 1, total)} bis{' '}
            {Math.min(page * limit, total)} von {total} Einträgen
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className={clsx(
            'p-2 rounded-lg transition-colors',
            page <= 1
              ? 'text-slate-600 cursor-not-allowed'
              : 'text-slate-400 hover:text-white hover:bg-slate-700'
          )}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        {start > 1 && (
          <>
            <button
              onClick={() => onPageChange(1)}
              className="px-3 py-1.5 text-sm rounded-lg text-slate-400 hover:text-white hover:bg-slate-700"
            >
              1
            </button>
            {start > 2 && <span className="text-slate-600">...</span>}
          </>
        )}

        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={clsx(
              'px-3 py-1.5 text-sm rounded-lg transition-colors',
              p === page
                ? 'bg-primary-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            )}
          >
            {p}
          </button>
        ))}

        {end < totalPages && (
          <>
            {end < totalPages - 1 && <span className="text-slate-600">...</span>}
            <button
              onClick={() => onPageChange(totalPages)}
              className="px-3 py-1.5 text-sm rounded-lg text-slate-400 hover:text-white hover:bg-slate-700"
            >
              {totalPages}
            </button>
          </>
        )}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className={clsx(
            'p-2 rounded-lg transition-colors',
            page >= totalPages
              ? 'text-slate-600 cursor-not-allowed'
              : 'text-slate-400 hover:text-white hover:bg-slate-700'
          )}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
