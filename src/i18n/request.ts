import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  // This typically corresponds to the `[locale]` segment
  let locale = await requestLocale;

  // Ensure that the incoming locale is valid
  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }

  const messages = {
    ...(await import(`@/messages/${locale}/common.json`)).default,
    ...(await import(`@/messages/${locale}/dashboard.json`)).default,
    ...(await import(`@/messages/${locale}/meetings.json`)).default,
    ...(await import(`@/messages/${locale}/projects.json`)).default,
    ...(await import(`@/messages/${locale}/goals.json`)).default,
    ...(await import(`@/messages/${locale}/agent.json`)).default,
  };

  return {
    locale,
    messages
  };
});
