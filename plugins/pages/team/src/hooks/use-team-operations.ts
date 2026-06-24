import { useState } from 'react';
import { inviteMember, updateMemberRole, removeMember, batchRemoveMembers } from '../api';
import type { TeamMember } from '../types';

export interface UseTeamOperationsReturn {
  submitting: boolean;
  inviteMember: (email: string, role: TeamMember['role']) => Promise<{ invitationUuid: string }>;
  deleteMember: (memberUuid: string) => Promise<void>;
  batchDeleteMembers: (memberUuids: string[]) => Promise<void>;
  changeMemberRole: (memberUuid: string, newRole: TeamMember['role']) => Promise<TeamMember>;
}

/**
 * 团队成员操作 Hook
 */
export function useTeamOperations(): UseTeamOperationsReturn {
  const [submitting, setSubmitting] = useState(false);

  // 邀请成员（单个）
  const inviteMemberOp = async (email: string, role: TeamMember['role']) => {
    if (!email.trim()) {
      throw new Error('请输入邮箱地址');
    }
    setSubmitting(true);
    try {
      const res = await inviteMember({ email, role });
      return { invitationUuid: res.invitation_uuid };
    } finally {
      setSubmitting(false);
    }
  };

  // 更新成员角色
  const changeMemberRole = async (memberUuid: string, newRole: TeamMember['role']) => {
    setSubmitting(true);
    try {
      return await updateMemberRole({ member_uuid: memberUuid, role: newRole });
    } finally {
      setSubmitting(false);
    }
  };

  // 删除成员
  const deleteMember = async (memberUuid: string) => {
    setSubmitting(true);
    try {
      await removeMember({ member_uuid: memberUuid });
    } finally {
      setSubmitting(false);
    }
  };

  // 批量删除成员
  const batchDeleteMembers = async (memberUuids: string[]) => {
    setSubmitting(true);
    try {
      await batchRemoveMembers({ member_uuids: memberUuids });
    } finally {
      setSubmitting(false);
    }
  };

  return {
    submitting,
    inviteMember: inviteMemberOp,
    deleteMember,
    batchDeleteMembers,
    changeMemberRole,
  };
}
