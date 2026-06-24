import { create } from 'zustand';
import {
  listMessages,
  markMessageRead,
  batchMarkMessagesRead,
  getMessageStats,
  handleMessage,
  type Message,
  type MessageListRequest,
} from '../api/messages';
import { acceptInvitation, rejectInvitation } from '../../../../pages/team/src/api';
import { useRefreshStore } from '../../../../services/store/src';
import { toast } from 'sonner';

const PAGE_SIZE = 20;

interface MessagesState {
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
}

interface MessagesActions {
  loadMessages: (page?: number, append?: boolean) => Promise<void>;
  loadStats: () => Promise<void>;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  markAsRead: (messageUuid: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  handleInvitation: (message: Message, action: 'accept' | 'reject') => Promise<void>;
  setMessageTypeFilter: (type: string | null) => void;
  setIsReadFilter: (isRead: boolean | null) => void;
}

export const useMessagesStore = create<MessagesState & MessagesActions>((set, get) => ({
  // State
  messages: [],
  stats: null,
  loading: false,
  error: null,
  currentPage: 1,
  totalPages: 1,
  messageTypeFilter: null,
  isReadFilter: null,

  // Actions
  loadMessages: async (page = 1, append = false) => {
    set({ loading: true, error: null });

    try {
      const { messageTypeFilter, isReadFilter } = get();
      const request: MessageListRequest = {
        page,
        page_size: PAGE_SIZE,
        filters: {
          ...(messageTypeFilter && { message_type: messageTypeFilter }),
          ...(isReadFilter !== null && { is_read: isReadFilter }),
        },
      };

      const response = await listMessages(request);

      set((state) => ({
        messages: append ? [...state.messages, ...response.items] : response.items,
        currentPage: page,
        totalPages: Math.ceil(response.total / PAGE_SIZE),
        loading: false,
      }));
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : '加载消息失败';
      set({ error: errorMessage, loading: false });
      console.error('Failed to load messages:', e);
    }
  },

  loadStats: async () => {
    try {
      const statsData = await getMessageStats();
      set({ stats: statsData });
    } catch (e) {
      console.error('Failed to load message stats:', e);
    }
  },

  refresh: async () => {
    const { loadMessages, loadStats } = get();
    await Promise.all([loadMessages(1, false), loadStats()]);
  },

  loadMore: async () => {
    const { currentPage, totalPages, loading, loadMessages } = get();
    if (currentPage < totalPages && !loading) {
      await loadMessages(currentPage + 1, true);
    }
  },

  markAsRead: async (messageUuid: string) => {
    try {
      await markMessageRead(messageUuid);
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg.message_uuid === messageUuid
            ? { ...msg, is_read: true, read_at: new Date().toISOString() }
            : msg
        ),
        stats: state.stats
          ? {
              ...state.stats,
              unread: Math.max(0, state.stats.unread - 1),
            }
          : null,
      }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '标记已读失败');
    }
  },

  markAllAsRead: async () => {
    const { messages } = get();
    const unreadMessages = messages.filter((msg) => !msg.is_read);
    if (unreadMessages.length === 0) return;

    try {
      const unreadUuids = unreadMessages.map((msg) => msg.message_uuid);
      await batchMarkMessagesRead(unreadUuids);

      set((state) => ({
        messages: state.messages.map((msg) => ({
          ...msg,
          is_read: true,
          read_at: msg.read_at || new Date().toISOString(),
        })),
        stats: state.stats
          ? {
              ...state.stats,
              unread: 0,
            }
          : null,
      }));

      toast.success(`已标记 ${unreadUuids.length} 条消息为已读`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '批量标记已读失败');
    }
  },

  handleInvitation: async (message: Message, action: 'accept' | 'reject') => {
    // 检查是否是团队邀请消息
    if (message.message_type !== 'team_invitation') {
      toast.error('操作失败');
      return;
    }

    // 检查是否已经处理过
    if (message.action_status === 'accepted' || message.action_status === 'rejected') {
      toast.error('该邀请已处理');
      return;
    }

    // 检查 metadata 中是否有 token
    if (!message.metadata || !message.metadata.token) {
      toast.error('邀请信息无效');
      return;
    }

    try {
      if (action === 'accept') {
        // 先接受邀请
        await acceptInvitation({ token: message.metadata.token as string });

        // 然后更新消息状态
        await handleMessage({
          message_uuid: message.message_uuid,
          action: 'accept',
        });

        // 标记消息为已读（如果还未读）
        if (!message.is_read) {
          await get().markAsRead(message.message_uuid);
        }

        // 更新本地状态
        set((state) => ({
          messages: state.messages.map((msg) =>
            msg.message_uuid === message.message_uuid
              ? {
                  ...msg,
                  action_status: 'accepted',
                  action_at: new Date().toISOString(),
                  is_read: true,
                  read_at: message.read_at || new Date().toISOString(),
                }
              : msg
          ),
        }));

        // 触发团队数据刷新
        useRefreshStore.getState().refreshTeams();

        toast.success('已接受邀请');
      } else {
        // 先拒绝邀请
        await rejectInvitation({ token: message.metadata.token as string });

        // 然后更新消息状态
        await handleMessage({
          message_uuid: message.message_uuid,
          action: 'reject',
        });

        // 标记消息为已读（如果还未读）
        if (!message.is_read) {
          await get().markAsRead(message.message_uuid);
        }

        // 更新本地状态
        set((state) => ({
          messages: state.messages.map((msg) =>
            msg.message_uuid === message.message_uuid
              ? {
                  ...msg,
                  action_status: 'rejected',
                  action_at: new Date().toISOString(),
                  is_read: true,
                  read_at: message.read_at || new Date().toISOString(),
                }
              : msg
          ),
        }));

        toast.success('已拒绝邀请');
      }

      // 刷新统计
      await get().loadStats();
    } catch (e) {
      const errorMessage =
        e instanceof Error ? e.message : action === 'accept' ? '接受邀请失败' : '拒绝邀请失败';
      toast.error(errorMessage);
      console.error('Failed to handle invitation:', e);
    }
  },

  setMessageTypeFilter: (type: string | null) => {
    set({ messageTypeFilter: type });
    // 筛选条件改变时重新加载
    get().loadMessages(1, false);
  },

  setIsReadFilter: (isRead: boolean | null) => {
    set({ isReadFilter: isRead });
    // 筛选条件改变时重新加载
    get().loadMessages(1, false);
  },
}));
