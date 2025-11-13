import createMiddleware from 'next-intl/middleware';
import {routing} from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Match all *pages*, skip API and static assets
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)'
};
