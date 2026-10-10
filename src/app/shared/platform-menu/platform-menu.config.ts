import { MenuAppConfig } from '@taliferro/ui/platform/universal-menu.model';

/** Pulse's part of the universal menu: what you can do in Pulse. */
export const PLATFORM_MENU_CONFIG: MenuAppConfig = {
  app: 'pulse',
  name: 'Pulse',
  items: [
    { label: 'Pulses', icon: 'grid', route: '/app', keywords: 'surveys home results' },
    { label: 'New pulse', icon: 'plus', route: '/survey-edit', keywords: 'new survey create write' },
  ],
  secondaryItems: [
    { label: 'Profile', icon: 'user', route: '/profile' },
    { label: 'Support', icon: 'chat', route: '/support' },
    { label: 'Help', icon: 'help', route: '/help' },
    { label: 'About', icon: 'info', route: '/about' },
    { label: 'iOS App', icon: 'phone', route: '/ios', keywords: 'iphone ipad app store pulsur' },
  ],
  signInRoute: '/get-started',
  profileRoute: '/profile',
};
