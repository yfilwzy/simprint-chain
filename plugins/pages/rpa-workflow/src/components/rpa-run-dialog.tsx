import { Play, RotateCcw, X } from 'lucide-react';
import { FormattedDialog, FormattedDialogFooter } from '@/components/formatted-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { RpaTask } from '../types';
import type { RpaTaskDetailDto } from '../api';

interface RpaRunDialogProps {
  open: boolean;
  loading?: boolean;
  pending: { task: RpaTask; detail: RpaTaskDetailDto } | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void> | void;
}

export function RpaRunDialog({
  open,
  loading = false,
  pending,
  onOpenChange,
  onConfirm,
}: RpaRunDialogProps) {
  const environmentCount = pending?.detail.environment_uuids.length ?? 0;
  const strategy = pending?.detail.task;
  const canRun = Boolean(pending && environmentCount > 0);

  return (
    <FormattedDialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!loading) {
          onOpenChange(isOpen);
        }
      }}
      minWidth="min-w-[520px]"
      header={{
        icon: Play,
        iconColor: 'text-primary',
        title: '开始执行任务',
        description: pending
          ? `将在 ${environmentCount} 个绑定环境中正式执行该任务。`
          : '将在已绑定环境上正式执行该任务。',
        gradient: 'bg-gradient-to-r from-primary/10 via-blue-500/10 to-primary/10',
        className: 'border-b border-primary/20',
      }}
      contentPadding="p-5"
    >
      <div className="space-y-4 text-sm">
        <div className="space-y-1">
          <div className="text-base font-semibold text-foreground">{pending?.task.name || '未选择任务'}</div>
          {pending?.task.description ? (
            <div className="text-xs text-muted-foreground">{pending.task.description}</div>
          ) : null}
        </div>

        <div className="rounded-md border border-border/50 bg-muted/20 p-3">
          <div className="mb-2 text-xs font-medium text-foreground">执行策略</div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className="gap-1">
              <RotateCcw className="h-3 w-3" />
              重试 {strategy?.retry_count ?? 3} 次
            </Badge>
            <Badge variant="outline">间隔 {strategy?.retry_interval ?? 5} 秒</Badge>
            <Badge variant="outline">超时 {strategy?.timeout ?? 300} 秒</Badge>
            {strategy?.stop_on_error ? <Badge variant="outline">出错时停止</Badge> : null}
          </div>
        </div>

        {pending && !canRun ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            请先为任务绑定环境后再执行。
          </div>
        ) : null}
      </div>

      <FormattedDialogFooter>
        <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={loading}>
          <X className="mr-1.5 h-4 w-4" />
          取消
        </Button>
        <Button type="button" size="sm" onClick={() => void onConfirm()} disabled={loading || !canRun}>
          <Play className="mr-1.5 h-4 w-4" />
          开始执行
        </Button>
      </FormattedDialogFooter>
    </FormattedDialog>
  );
}
