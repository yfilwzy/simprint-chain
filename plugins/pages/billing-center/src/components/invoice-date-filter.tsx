import { useState } from 'react';
import { X, CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface InvoiceDateFilterProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
}

/**
 * 账单日期筛选组件
 */
export function InvoiceDateFilter({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: InvoiceDateFilterProps) {
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return null;
    try {
      return format(new Date(dateStr), 'MM/dd', { locale: zhCN });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex items-center gap-0.5">
      <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
        <PopoverTrigger asChild>
          <button className="h-5 px-1 flex items-center gap-0.5 rounded hover:bg-accent transition-colors text-[9px]">
            {startDate ? (
              <span className="text-primary font-bold bg-primary/10 px-1 rounded">
                {formatDateDisplay(startDate)}
              </span>
            ) : (
              <CalendarIcon className="h-3 w-3" />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={startDate ? new Date(startDate) : undefined}
            onSelect={(date) => {
              onStartDateChange(date ? format(date, 'yyyy-MM-dd') : '');
              setStartDateOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      <span className="text-muted-foreground">-</span>
      <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
        <PopoverTrigger asChild>
          <button className="h-5 px-1 flex items-center gap-0.5 rounded hover:bg-accent transition-colors text-[9px]">
            {endDate ? (
              <span className="text-primary font-bold bg-primary/10 px-1 rounded">
                {formatDateDisplay(endDate)}
              </span>
            ) : (
              <CalendarIcon className="h-3 w-3" />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={endDate ? new Date(endDate) : undefined}
            onSelect={(date) => {
              onEndDateChange(date ? format(date, 'yyyy-MM-dd') : '');
              setEndDateOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      {(startDate || endDate) && (
        <button
          onClick={() => {
            onStartDateChange('');
            onEndDateChange('');
          }}
          className="h-4 w-4 flex items-center justify-center rounded-full hover:bg-destructive/20 text-destructive transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
