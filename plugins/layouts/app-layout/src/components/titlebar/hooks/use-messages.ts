import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  listMessages,
  markMessageRead,
  batchMarkMessagesRead,
  getMessageStats,
  handleMessage,
  type Message,
  type MessageListRequest,
} from '../../../api/messages';
import { acceptInvitation, rejectInvitation } from '../../../../../../pages/team/src/api';
import { useRefreshStore } from '../../../../../../services/store/src';
import { toast } from 'sonner';

export interface UseMessagesReturn {
  messages: Message[];
  stats: {
    total: number;
    unread: number;
    by_type: Record<string, number>;
  } | null;
  loading: boolean;
  error: string | null;
  currentPage: number;
  totalPages: number;
  messageTypeFilter: string | null;
  isReadFilter: boolean | null;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  markAsRead: (messageUuid: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  handleInvitation: (message: Message, action: 'accept' | 'reject') => Promise<void>;
  setMessageTypeFilter: (type: string | null) => void;
  setIsReadFilter: (isRead: boolean | null) => void;
}

const PAGE_SIZE = 20;

/**
 * 消息管理 Hook
 */
export function useMessages(): UseMessagesReturn {
  const { t } = useTranslation('appLayout');
  const [messages, setMessages] = useState<Message[]>([]);
  const [stats, setStats] = useState<UseMessagesReturn['stats']>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [messageTypeFilter, setMessageTypeFilter] = useState<string | null>(null);
  const [isReadFilter, setIsReadFilter] = useState<boolean | null>(null);

  // 加载消息列表
  const loadMessages = useCallback(
    async (page: number = 1, append: boolean = false) => {
      setLoading(true);
      setError(null);

      try {
        const request: MessageListRequest = {
          page,
          page_size: PAGE_SIZE,
          filters: {
            ...(messageTypeFilter && { message_type: messageTypeFilter }),
            ...(isReadFilter !== null && { is_read: isReadFilter }),
          },
        };

        const response = await listMessages(request);

        if (append) {
          setMessages((prev) => [...prev, ...response.items]);
        } else {
          setMessages(response.items);
        }

        setCurrentPage(page);
        setTotalPages(Math.ceil(response.total / PAGE_SIZE));
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : '加载消息失败';
        setError(errorMessage);
        console.error('Failed to load messages:', e);
      } finally {
        setLoading(false);
      }
    },
    [messageTypeFilter, isReadFilter]
  );

  // 加载消息统计
  const loadStats = useCallback(async () => {
    try {
      const statsData = await getMessageStats();
      setStats(statsData);
    } catch (e) {
      console.error('Failed to load message stats:', e);
    }
  }, []);

  // 刷新消息列表
  const refresh = useCallback(async () => {
    await Promise.all([loadMessages(1, false), loadStats()]);
  }, [loadMessages, loadStats]);

  // 加载更多
  const loadMore = useCallback(async () => {
    if (currentPage < totalPages && !loading) {
      await loadMessages(currentPage + 1, true);
    }
  }, [currentPage, totalPages, loading, loadMessages]);

  // 标记为已读
  const markAsRead = useCallback(
    async (messageUuid: string) => {
      try {
        await markMessageRead(messageUuid);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.message_uuid === messageUuid
              ? { ...msg, is_read: true, read_at: new Date().toISOString() }
              : msg
          )
        );
        // 更新统计
        if (stats) {
          setStats({
            ...stats,
            unread: Math.max(0, stats.unread - 1),
          });
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '标记已读失败');
      }
    },
    [stats]
  );

  // 标记所有为已读
  const markAllAsRead = useCallback(async () => {
    const unreadMessages = messages.filter((msg) => !msg.is_read);
    if (unreadMessages.length === 0) return;

    try {
      const unreadUuids = unreadMessages.map((msg) => msg.message_uuid);
      await batchMarkMessagesRead(unreadUuids);

      setMessages((prev) =>
        prev.map((msg) => ({
          ...msg,
          is_read: true,
          read_at: msg.read_at || new Date().toISOString(),
        }))
      );

      // 更新统计
      if (stats) {
        setStats({
          ...stats,
          unread: 0,
        });
      }

      toast.success(`已标记 ${unreadUuids.length} 条消息为已读`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '批量标记已读失败');
    }
  }, [messages, stats]);

  // 处理邀请（接受/拒绝）
  const handleInvitation = useCallback(
    async (message: Message, action: 'accept' | 'reject') => {
      // 检查是否是团队邀请消息
      if (message.message_type !== 'team_invitation') {
        toast.error(t('notification.acceptInvitationFailed'));
        return;
      }

      // 检查是否已经处理过
      if (message.action_status === 'accepted' || message.action_status === 'rejected') {
        toast.error(t('notification.acceptInvitationFailed'));
        return;
      }

      // 检查 metadata 中是否有 token
      if (!message.metadata || !message.metadata.token) {
        toast.error(t('notification.acceptInvitationFailed'));
        return;
      }

      try {
        if (action === 'accept') {
          // 先接受邀请
          const teamUuid = await acceptInvitation({ token: message.metadata.token as string });

          // 然后更新消息状态
          await handleMessage({
            message_uuid: message.message_uuid,
            action: 'accept',
          });

          // 标记消息为已读（如果还未读）
          if (!message.is_read) {
            await markAsRead(message.message_uuid);
          }

          // 更新本地状态
          setMessages((prev) =>
            prev.map((msg) =>
              msg.message_uuid === message.message_uuid
                ? {
                    ...msg,
                    action_status: 'accepted',
                    action_at: new Date().toISOString(),
                    is_read: true,
                    read_at: message.read_at || new Date().toISOString(),
                  }
                : msg
            )
          );

          // 触发团队数据刷新（让 user-menu 和 team-header 重新加载团队列表）
          useRefreshStore.getState().refreshTeams();

          toast.success(t('notification.acceptInvitationSuccess'));
        } else {
          // 先拒绝邀请（更新 team_invitations 表的状态）
          await rejectInvitation({ token: message.metadata.token as string });

          // 然后更新消息状态
          await handleMessage({
            message_uuid: message.message_uuid,
            action: 'reject',
          });

          // 标记消息为已读（如果还未读）
          if (!message.is_read) {
            await markAsRead(message.message_uuid);
          }

          // 更新本地状态
          setMessages((prev) =>
            prev.map((msg) =>
              msg.message_uuid === message.message_uuid
                ? {
                    ...msg,
                    action_status: 'rejected',
                    action_at: new Date().toISOString(),
                    is_read: true,
                    read_at: message.read_at || new Date().toISOString(),
                  }
                : msg
            )
          );

          toast.success(t('notification.rejectInvitationSuccess'));
        }

        // 刷新统计
        await loadStats();
      } catch (e) {
        const errorMessage =
          e instanceof Error
            ? e.message
            : action === 'accept'
              ? t('notification.acceptInvitationFailed')
              : t('notification.rejectInvitationFailed');
        toast.error(errorMessage);
        console.error('Failed to handle invitation:', e);
      }
    },
    [loadStats, t, markAsRead]
  );

  // 初始加载和筛选条件改变时重新加载
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageTypeFilter, isReadFilter]);

  return {
    messages,
    stats,
    loading,
    error,
    currentPage,
    totalPages,
    messageTypeFilter,
    isReadFilter,
    refresh,
    loadMore,
    markAsRead,
    markAllAsRead,
    handleInvitation,
    setMessageTypeFilter,
    setIsReadFilter,
  };
}
