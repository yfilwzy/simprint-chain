import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import { Loader2, Repeat, X } from 'lucide-react';
import {
  LOOP_REGION_CONTENT_BOTTOM,
  LOOP_REGION_CONTENT_TOP,
  LOOP_REGION_HEADER_HEIGHT,
  LOOP_REGION_HINT_HEIGHT,
  LOOP_REGION_PADDING_RIGHT,
  LOOP_REGION_PADDING_X,
} from '../loop-layout';

export interface LoopNodeData {
  label: string;
  subtitle?: string;
  enabled: boolean;
  childCount?: number;
  runStatus?: 'pending' | 'running' | 'awaiting_input' | 'success' | 'failed';
  errorSummary?: string;
  onDelete?: (id: string) => void;
}

function LoopNodeComponent({ id, data, selected }: NodeProps) {
  const { t } = useTranslation('rpa');
  const nodeData = data as unknown as LoopNodeData;
  const runStatus = nodeData.runStatus ?? 'pending';

  return (
    <div
      className={`relative h-full w-full rounded-2xl border-2 border-emerald-500/50 bg-emerald-500/5 shadow-sm transition-all ${
        selected ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''
      } ${!nodeData.enabled ? 'opacity-60' : ''}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-background"
      />

      <div className="flex h-12 items-center justify-between rounded-t-2xl border-b border-emerald-500/20 bg-emerald-500/10 px-4">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-background/70 text-emerald-600">
            <Repeat className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold text-foreground">{nodeData.label}</div>
            <div className="truncate text-[10px] text-muted-foreground">
              {nodeData.subtitle || t('editor.stepSubtitleDefaults.loop', { defaultValue: '配置循环区域' })}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {runStatus === 'running' || runStatus === 'awaiting_input' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
          ) : null}
          {nodeData.onDelete ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                nodeData.onDelete?.(id);
              }}
              className="flex h-5 w-5 items-center justify-center rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          ) : null}
        </div>
      </div>

      <div
        className="pointer-events-none absolute rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3"
        style={{
          left: LOOP_REGION_PADDING_X,
          right: LOOP_REGION_PADDING_RIGHT,
          top: LOOP_REGION_HEADER_HEIGHT + 16,
          height: LOOP_REGION_HINT_HEIGHT,
        }}
      >
        <div className="text-[11px] text-muted-foreground">
          {t('editor.loop.dropHint', { defaultValue: '将节点拖入此区域，区域内节点会作为循环体。' })}
        </div>
      </div>

      <div
        className="pointer-events-none absolute rounded-2xl border border-dashed border-emerald-500/25 bg-background/60"
        style={{
          left: LOOP_REGION_PADDING_X,
          right: LOOP_REGION_PADDING_RIGHT,
          top: LOOP_REGION_CONTENT_TOP,
          bottom: LOOP_REGION_CONTENT_BOTTOM,
        }}
      >
        <div className="flex h-full flex-col justify-end px-4 py-3">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>
              {t('editor.loop.childCount', {
                count: nodeData.childCount ?? 0,
                defaultValue: `循环体节点 ${(nodeData.childCount ?? 0).toString()} 个`,
              })}
            </span>
            <span>
              {t('editor.loop.doneHint', { defaultValue: '区域外连线表示循环完成后继续执行' })}
            </span>
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-background"
      />
    </div>
  );
}

export const LoopNode = memo(LoopNodeComponent);
