import { toast } from 'sonner';
import { useTeamDialogStore } from '../stores';
import type { TeamMember } from '../types';
import type { UseTeamOperationsReturn } from './use-team-operations';

interface UseTeamHandlersParams {
  operations: UseTeamOperationsReturn;
  onRefresh: () => Promise<void>;
}

/**
 * 团队成员事件处理 Hook
 */
export function useTeamHandlers({ operations, onRefresh }: UseTeamHandlersParams) {
  const dialogStore = useTeamDialogStore();

  // 邀请成员
  const handleInvite = () => {
    dialogStore.openInviteDialog();
  };

  const handleSubmitInvite = async () => {
    if (!dialogStore.inviteEmail.trim()) {
      toast.warning('请输入邮箱地址');
      return;
    }
    try {
      await operations.inviteMember(dialogStore.inviteEmail, dialogStore.inviteRole);
      dialogStore.closeInviteDialog();
      toast.success('邀请已发送');
      await onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '邀请成员失败');
    }
  };

  // 删除成员
  const handleDeleteMember = (id: string, name: string) => {
    dialogStore.openDeleteDialog({ id, name });
  };

  const handleConfirmDelete = async () => {
    if (!dialogStore.deletingMember) return;
    try {
      await operations.deleteMember(dialogStore.deletingMember.id);
      dialogStore.closeDeleteDialog();
      toast.success('移除成员成功');
      await onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '移除成员失败');
    }
  };

  // 批量删除
  const handleBatchDelete = (selectedIds: Set<string>) => {
    if (selectedIds.size === 0) return;
    dialogStore.openBatchDeleteDialog();
  };

  const handleConfirmBatchDelete = async (selectedIds: Set<string>) => {
    try {
      await operations.batchDeleteMembers(Array.from(selectedIds));
      dialogStore.closeBatchDeleteDialog();
      toast.success(`成功移除 ${selectedIds.size} 名成员`);
      await onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '批量移除失败');
    }
  };

  // 更改角色
  const handleChangeRole = (member: TeamMember, newRole: TeamMember['role']) => {
    dialogStore.openRoleChangeDialog(member, newRole);
  };

  const handleConfirmRoleChange = async () => {
    if (!dialogStore.changingMember) return;
    try {
      await operations.changeMemberRole(dialogStore.changingMember.id, dialogStore.newRole);
      dialogStore.closeRoleChangeDialog();
      toast.success('更新角色成功');
      await onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '更新角色失败');
    }
  };

  return {
    handleInvite,
    handleSubmitInvite,
    handleDeleteMember,
    handleConfirmDelete,
    handleBatchDelete,
    handleConfirmBatchDelete,
    handleChangeRole,
    handleConfirmRoleChange,
  };
}
