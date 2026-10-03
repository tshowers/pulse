import { MenuAppConfig } from '@taliferro/ui/platform/universal-menu.model';

/** Pulse's part of the universal menu: what you can do in Pulse. */
export const PLATFORM_MENU_CONFIG: MenuAppConfig = {
  app: 'pulse',
  name: 'Pulse',
  logo: 'assets/find/entities/pulse/logo.png',
  items: [
    { label: 'Home', icon: 'home', route: '/' },
    { label: 'Pulse Home', icon: 'grid', route: '/app' },
    { label: 'Current Pulse', icon: 'activity', route: '/survey-list', keywords: 'surveys' },
    { label: 'Create a Pulse', icon: 'plus', route: '/survey-edit', keywords: 'new survey' },
  ],
  secondaryItems: [
    { label: 'Profile', icon: 'user', route: '/profile' },
    { label: 'Support', icon: 'chat', route: '/support' },
    { label: 'Help', icon: 'help', route: '/help' },
    { label: 'iOS App', icon: 'phone', route: '/ios', keywords: 'iphone ipad app store' },
  ],
  signInRoute: '/get-started',
  profileRoute: '/profile',
};
