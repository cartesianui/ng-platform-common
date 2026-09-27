import { Injectable, TemplateRef, Type, inject } from '@angular/core';
import { BsModalRef, BsModalService, ModalOptions } from 'ngx-bootstrap/modal';
import { firstValueFrom, take } from 'rxjs';
import { ConfirmDialogComponent } from './confirm-dialog.component';
import { AppDialogConfirmOptions, AppDialogOpenOptions } from './dialog.types';

@Injectable({ providedIn: 'root' })
export class AppDialogService {
  private bsModal = inject(BsModalService);

  confirm(options: AppDialogConfirmOptions): Promise<boolean> {
    const initialState: Partial<ConfirmDialogComponent> = {
      title: options.title ?? 'Confirm',
      message: options.message,
      template: options.template,
      templateContext: options.templateContext,
      kind: options.kind ?? 'info',
      okLabel: options.okLabel ?? 'Confirm',
      cancelLabel: options.cancelLabel ?? 'Cancel',
    };

    // `app-dialog-host` is the hook our global scss uses to zero-out
    // ngx-bootstrap's default .modal-content padding so the inner shell
    // (`.app-dialog`) controls all spacing itself.
    const ref = this.bsModal.show(ConfirmDialogComponent, {
      initialState: initialState as any,
      class: `${this.sizeClass(options.size)} app-dialog-host`,
      backdrop: 'static',
      keyboard: true,
      ignoreBackdropClick: true,
    });

    return firstValueFrom(this.bsModal.onHidden.pipe(take(1))).then(() => {
      const result = (ref.content as ConfirmDialogComponent)?.result === true;
      return result;
    });
  }

  open(content: TemplateRef<any> | Type<any>, options: AppDialogOpenOptions = {}): BsModalRef {
    const config: ModalOptions = {
      class: options.class ?? this.sizeClass(options.size),
      backdrop: options.backdrop ?? true,
      keyboard: options.keyboard ?? true,
      ignoreBackdropClick: options.ignoreBackdropClick ?? false,
      initialState: options.initialState,
    };
    return this.bsModal.show(content as any, config);
  }

  private sizeClass(size?: 'sm' | 'md' | 'lg' | 'xl'): string {
    switch (size) {
      case 'sm': return 'modal-sm modal-dialog-centered';
      case 'lg': return 'modal-lg modal-dialog-centered';
      case 'xl': return 'modal-xl modal-dialog-centered';
      default: return 'modal-dialog-centered';
    }
  }
}