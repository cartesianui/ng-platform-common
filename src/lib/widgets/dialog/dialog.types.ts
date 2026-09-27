import { TemplateRef, Type } from '@angular/core';

export type AppDialogKind = 'info' | 'success' | 'warning' | 'danger';

export interface AppDialogConfirmOptions {
  title?: string;
  message?: string;
  template?: TemplateRef<any>;
  templateContext?: any;
  kind?: AppDialogKind;
  okLabel?: string;
  cancelLabel?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export interface AppDialogOpenOptions {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  backdrop?: boolean | 'static';
  keyboard?: boolean;
  ignoreBackdropClick?: boolean;
  class?: string;
  initialState?: Record<string, any>;
}

export type AppDialogContent = TemplateRef<any> | Type<any>;