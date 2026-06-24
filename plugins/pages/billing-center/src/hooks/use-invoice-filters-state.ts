import { useState, useCallback } from 'react';
import type { InvoiceStatusFilter } from '../types';

interface InvoiceFiltersState {
  searchQuery: string;
  statusFilter: InvoiceStatusFilter;
  typeFilter: string;
  startDate: string;
  endDate: string;
}

interface UseInvoiceFiltersStateReturn {
  filters: InvoiceFiltersState;
  setSearchQuery: (value: string) => void;
  setStatusFilter: (value: InvoiceStatusFilter) => void;
  setTypeFilter: (value: string) => void;
  setStartDate: (value: string) => void;
  setEndDate: (value: string) => void;
  resetFilters: () => void;
  updateFilter: (filterType: keyof InvoiceFiltersState, value: string) => void;
}

/**
 * 发票过滤状态管理 Hook
 */
export function useInvoiceFiltersState(onFilterChange?: () => void): UseInvoiceFiltersStateReturn {
  const [searchQuery, setSearchQueryState] = useState('');
  const [statusFilter, setStatusFilterState] = useState<InvoiceStatusFilter>('all');
  const [typeFilter, setTypeFilterState] = useState('');
  const [startDate, setStartDateState] = useState('');
  const [endDate, setEndDateState] = useState('');

  const handleFilterChange = useCallback(() => {
    onFilterChange?.();
  }, [onFilterChange]);

  const setSearchQuery = useCallback(
    (value: string) => {
      setSearchQueryState(value);
      handleFilterChange();
    },
    [handleFilterChange]
  );

  const setStatusFilter = useCallback(
    (value: InvoiceStatusFilter) => {
      setStatusFilterState(value);
      handleFilterChange();
    },
    [handleFilterChange]
  );

  const setTypeFilter = useCallback(
    (value: string) => {
      setTypeFilterState(value);
      handleFilterChange();
    },
    [handleFilterChange]
  );

  const setStartDate = useCallback(
    (value: string) => {
      setStartDateState(value);
      handleFilterChange();
    },
    [handleFilterChange]
  );

  const setEndDate = useCallback(
    (value: string) => {
      setEndDateState(value);
      handleFilterChange();
    },
    [handleFilterChange]
  );

  const resetFilters = useCallback(() => {
    setSearchQueryState('');
    setStatusFilterState('all');
    setTypeFilterState('');
    setStartDateState('');
    setEndDateState('');
    handleFilterChange();
  }, [handleFilterChange]);

  const updateFilter = useCallback(
    (filterType: keyof InvoiceFiltersState, value: string) => {
      switch (filterType) {
        case 'searchQuery':
          setSearchQueryState(value);
          break;
        case 'statusFilter':
          setStatusFilterState(value as InvoiceStatusFilter);
          break;
        case 'typeFilter':
          setTypeFilterState(value);
          break;
        case 'startDate':
          setStartDateState(value);
          break;
        case 'endDate':
          setEndDateState(value);
          break;
      }
      handleFilterChange();
    },
    [handleFilterChange]
  );

  return {
    filters: {
      searchQuery,
      statusFilter,
      typeFilter,
      startDate,
      endDate,
    },
    setSearchQuery,
    setStatusFilter,
    setTypeFilter,
    setStartDate,
    setEndDate,
    resetFilters,
    updateFilter,
  };
}
