import { WorkspaceRole, PermissionAction, SaasError, OrganizationMember } from './types';
import { getTenantStore } from './tenantStore';

/**
 * Role Permission Matrix defining explicit capabilities per role
 */
const ROLE_PERMISSIONS: Record<WorkspaceRole, Set<PermissionAction>> = {
  OWNER: new Set<PermissionAction>([
    'project.read', 'project.create', 'project.edit', 'project.delete',
    'asset.read', 'asset.create', 'asset.edit', 'asset.delete',
    'asset.render', 'asset.approve',
    'publish.create', 'publish.execute',
    'billing.view', 'billing.manage',
    'workspace.manage',
    'members.invite', 'members.manage',
    'apikeys.manage',
    'analytics.view',
    'client.portal_access'
  ]),

  ADMIN: new Set<PermissionAction>([
    'project.read', 'project.create', 'project.edit', 'project.delete',
    'asset.read', 'asset.create', 'asset.edit',
    'asset.render', 'asset.approve',
    'publish.create', 'publish.execute',
    'billing.view',
    'workspace.manage',
    'members.invite', 'members.manage',
    'apikeys.manage',
    'analytics.view',
    'client.portal_access'
  ]),

  MANAGER: new Set<PermissionAction>([
    'project.read', 'project.create', 'project.edit',
    'asset.read', 'asset.create', 'asset.edit',
    'asset.render', 'asset.approve',
    'publish.create', 'publish.execute',
    'members.invite',
    'analytics.view',
    'client.portal_access'
  ]),

  EDITOR: new Set<PermissionAction>([
    'project.read', 'project.create', 'project.edit',
    'asset.read', 'asset.create', 'asset.edit',
    'asset.render',
    'publish.create',
    'analytics.view'
  ]),

  APPROVER: new Set<PermissionAction>([
    'project.read',
    'asset.read',
    'asset.approve',
    'analytics.view',
    'client.portal_access'
  ]),

  CLIENT: new Set<PermissionAction>([
    'project.read',
    'asset.read',
    'asset.approve',
    'client.portal_access',
    'analytics.view'
  ]),

  VIEWER: new Set<PermissionAction>([
    'project.read',
    'asset.read',
    'analytics.view'
  ])
};

export interface AuthorizationContext {
  userId: string;
  role: WorkspaceRole;
  workspaceId: string;
  organizationId: string;
  isPlatformAdmin?: boolean;
}

/**
 * Evaluates whether a role or user context has permission to execute an action
 */
export function hasPermission(role: WorkspaceRole, action: PermissionAction): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  return permissions.has(action);
}

/**
 * Centralized authorization engine: can(user, action, resource)
 */
export async function can(
  auth: AuthorizationContext,
  action: PermissionAction,
  resource?: { workspaceId?: string; organizationId?: string; clientId?: string }
): Promise<boolean> {
  // Platform admins have global override for debugging/audit
  if (auth.isPlatformAdmin) {
    return true;
  }

  // Tenant Boundary Check: verify user is in the correct workspace/org
  if (resource?.workspaceId && resource.workspaceId !== auth.workspaceId) {
    return false; // Cross-workspace violation!
  }

  if (resource?.organizationId && resource.organizationId !== auth.organizationId) {
    return false; // Cross-organization violation!
  }

  // Check role-based permission
  return hasPermission(auth.role, action);
}

/**
 * Enforces permission check and throws SaasError('FORBIDDEN') if unauthorized
 */
export async function authorizeOrThrow(
  auth: AuthorizationContext,
  action: PermissionAction,
  resource?: { workspaceId?: string; organizationId?: string; clientId?: string }
): Promise<void> {
  const allowed = await can(auth, action, resource);
  if (!allowed) {
    throw new SaasError(
      'FORBIDDEN',
      `User ${auth.userId} with role ${auth.role} is not authorized to perform '${action}'`,
      403,
      { requiredAction: action, currentRole: auth.role }
    );
  }
}

/**
 * Resolves user authorization context for a given workspace
 */
export async function resolveAuthContext(
  userId: string,
  workspaceId: string
): Promise<AuthorizationContext> {
  const store = getTenantStore();
  const member = await store.getMember(workspaceId, userId);
  
  if (!member) {
    throw new SaasError('FORBIDDEN', `User is not a member of workspace ${workspaceId}`, 403);
  }

  return {
    userId,
    role: member.role,
    workspaceId: member.workspaceId,
    organizationId: member.organizationId,
  };
}
