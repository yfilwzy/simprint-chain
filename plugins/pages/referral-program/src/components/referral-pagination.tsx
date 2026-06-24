import { useTranslation } from 'react-i18next';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

interface ReferralPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  namespace: 'rewards' | 'users';
}

export const ReferralPagination: React.FC<ReferralPaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  namespace,
}) => {
  const { t } = useTranslation('referral');
  const safeTotalPages = Math.max(totalPages, 1);
  const safeCurrentPage = Math.min(Math.max(currentPage, 1), safeTotalPages);

  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    const maxVisible = 7;

    if (safeTotalPages <= maxVisible) {
      for (let i = 1; i <= safeTotalPages; i++) {
        pages.push(i);
      }
    } else {
      if (safeCurrentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('ellipsis');
        pages.push(safeTotalPages);
      } else if (safeCurrentPage >= safeTotalPages - 2) {
        pages.push(1);
        pages.push('ellipsis');
        for (let i = safeTotalPages - 3; i <= safeTotalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('ellipsis');
        for (let i = safeCurrentPage - 1; i <= safeCurrentPage + 1; i++) pages.push(i);
        pages.push('ellipsis');
        pages.push(safeTotalPages);
      }
    }

    return pages;
  };

  return (
    <div className="flex items-center justify-between px-6 py-2 border-t border-border bg-background/10 backdrop-blur-2xl">
      <div className="text-xs text-muted-foreground whitespace-nowrap">
        {t(`${namespace}.pagination.pageInfo`, {
          current: safeCurrentPage,
          total: safeTotalPages,
        })}
      </div>
      <Pagination className="flex justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={(e) => {
                e.preventDefault();
                if (safeCurrentPage > 1) onPageChange(safeCurrentPage - 1);
              }}
              className={safeCurrentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
            >
              {t(`${namespace}.pagination.previous`)}
            </PaginationPrevious>
          </PaginationItem>

          {getPageNumbers().map((page, index) => (
            <PaginationItem key={index}>
              {page === 'ellipsis' ? (
                <PaginationEllipsis />
              ) : (
                <PaginationLink
                  onClick={(e) => {
                    e.preventDefault();
                    onPageChange(page);
                  }}
                  isActive={page === safeCurrentPage}
                  className="cursor-pointer"
                >
                  {page}
                </PaginationLink>
              )}
            </PaginationItem>
          ))}

          <PaginationItem>
            <PaginationNext
              onClick={(e) => {
                e.preventDefault();
                if (safeCurrentPage < safeTotalPages) onPageChange(safeCurrentPage + 1);
              }}
              className={
                safeCurrentPage === safeTotalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'
              }
            >
              {t(`${namespace}.pagination.next`)}
            </PaginationNext>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
};
