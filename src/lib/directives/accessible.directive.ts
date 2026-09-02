import { Directive, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';
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
  standalone: true
})
export class AccessibleDirective {
  private hasView = false;

  /**
   * STANDALONE, and REACTIVE — both changed 2026-09-01, and both were blockers.
   *
   * `standalone: false` meant this directive could not be imported by a standalone component
   * at all, which is most of the app now. Its only three usages were inside NgModule-declared
   * templates, so the limit had never been felt — the first standalone screen that needed to
   * gate something (the Adjustments tab) could not use it.
   *
   * The reactivity matters more. It used to resolve ONCE, in an `@Input` setter. Permissions
   * arrive from the config bundle, which the app initializer loads at bootstrap AND AGAIN
   * after a successful login — by which point the setter has long since run. So a gated
   * element decided its visibility against the pre-login (empty) permission set and kept that
   * answer until a manual page reload. `PermissionCheckerService` documents this exact failure
   * against the nav menu and grew a `version` signal for it; reading the check inside an
   * `effect` is what makes this directive honour it.
   *
   * A gate that silently fails CLOSED after login is not much better than no gate: the tab
   * simply is not there, and nobody reports a missing thing they never saw.
   */
  readonly accessible = input.required<string[] | AccessibleConfig>();

  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);
  private permissionCheckerService = inject(PermissionCheckerService);

  constructor() {
    effect(() => {
      // Both reads must happen INSIDE the effect: the input for template changes, and the
      // permission check (which tracks the service's `version` signal) for login.
      this.updateView(this.accessible());
    });
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
