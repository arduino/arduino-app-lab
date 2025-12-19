import { FunctionComponent, SVGProps } from 'react';
import { ToastOptions as rtToastOptions } from 'react-toastify';

export enum ToastSize {
  Small,
  Regular,
}

type ToastOptions = Omit<rtToastOptions<Record<string, unknown>>, 'id'>;

export type OnToastUnmount = (...args: any) => any;

export interface ToastNotification {
  message: string;
  toastId?: string;
  toastType?: ToastType;
  toastIcon?: ToastIcon;
  toastOnClose?: ToastOnCloseHandler;
  toastActions?: ToastActionItems;
  toastOptions?: ToastOptions;
  toastSize?: ToastSize;
  onUnmount?: OnToastUnmount;
}

export interface ToastDismissal {
  toastId: string;
}

export type NotificationsLogic = () => {
  latestToastNotification: ToastNotification | null;
  latestToastDismissal?: ToastDismissal;
};

export type ToastOnCloseHandler = () => void;

interface ToastActionItem {
  id: string;
  handler: () => void;
  label: string;
}

export type ToastActionItems = ToastActionItem[];

export enum ToastType {
  Passive,
  Persistent,
}

export enum ToastIcon {
  Success,
}

export type ToastIconDictionary = {
  [I in ToastIcon]: FunctionComponent<
    SVGProps<SVGSVGElement> & { title?: string | undefined }
  >;
};
