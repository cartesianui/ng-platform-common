import { Directive, Input, OnInit, TemplateRef, ViewContainerRef } from '@angular/core';
import { PermissionCheckerService } from '@cartesianui/core';

/**
 * Structural directive to show/hide elements based on permissions and roles
 *
 * Usage:
 * <div *accessible="{ permissions: ['Pages.Users.View'], roles: ['admin'], onlyFor: ['super-admin'] }">
 *   Content visible only to users with required access
 * </div>
 *
 * Or with simple permission array:
 * <div *accessible="['Pages.Users.View']">Content</div>
 *
 * Logic:
 * - permissions: User must have at least ONE of these permissions (OR logic)
 * - roles: User must have at least ONE of these roles (OR logic)
 * - onlyFor: User must have at least ONE of these exclusive roles (OR logic)
 * - All conditions must be satisfied (AND logic between permissions, roles, and onlyFor)
 */
@Directive({
  selector: '[accessible]',
  standalone: false
})
export class AccessibleDirective implements OnInit {
  private hasView = false;

  @Input() set accessible(value: string[] | AccessibleConfig) {
    this.updateView(value);
  }

  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private permissionCheckerService: PermissionCheckerService
  ) {}

  ngOnInit() {
    // View will be updated in the setter
  }

  private updateView(value: string[] | AccessibleConfig) {
    const config = this.normalizeConfig(value);
    const hasAccess = this.checkAccess(config);

    if (hasAccess && !this.hasView) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.hasView = true;
    } else if (!hasAccess && this.hasView) {
      this.viewContainer.clear();
      this.hasView = false;
    }
  }

  private normalizeConfig(value: string[] | AccessibleConfig): AccessibleConfig {
    // If array is provided, treat it as permissions
    if (Array.isArray(value)) {
      return { permissions: value };
    }
    return value || {};
  }

  private checkAccess(config: AccessibleConfig): boolean {
    const { permissions, roles, onlyFor } = config;

    // Check permissions (user must have at least one)
    const hasPermission = !permissions ||
      permissions.length === 0 ||
      permissions.some(p => this.permissionCheckerService.isGranted(p));

    // Check roles (user must have at least one)
    const hasRole = !roles ||
      roles.length === 0 ||
      this.permissionCheckerService.hasAnyRole(roles);

    // Check onlyFor (user must have at least one of these exclusive roles)
    const hasOnlyForRole = !onlyFor ||
      onlyFor.length === 0 ||
      this.permissionCheckerService.hasAnyRole(onlyFor);

    // All conditions must be satisfied (AND logic)
    return hasPermission && hasRole && hasOnlyForRole;
  }
}

export interface AccessibleConfig {
  permissions?: string[];
  roles?: string[];
  onlyFor?: string[];
}
