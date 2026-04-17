import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

type MessageRecord = Record<string, unknown>;

/** Recursively merge b into a (b wins on scalar conflicts). */
function deepMerge(a: MessageRecord, b: MessageRecord): MessageRecord {
  const result: MessageRecord = { ...a };
  for (const key of Object.keys(b)) {
    const aVal = result[key];
    const bVal = b[key];
    if (
      aVal !== null &&
      bVal !== null &&
      typeof aVal === 'object' &&
      typeof bVal === 'object' &&
      !Array.isArray(aVal) &&
      !Array.isArray(bVal)
    ) {
      result[key] = deepMerge(aVal as MessageRecord, bVal as MessageRecord);
    } else {
      result[key] = bVal;
    }
  }
  return result;
}

function mergeAll(...sources: MessageRecord[]): MessageRecord {
  return sources.reduce((acc, src) => deepMerge(acc, src), {} as MessageRecord);
}

export default getRequestConfig(async ({ requestLocale }) => {
  // This typically corresponds to the `[locale]` segment
  let locale = await requestLocale;

  // Ensure that the incoming locale is valid
  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }

  const messages = mergeAll(
    (await import(`@/messages/${locale}/common.json`)).default,
    (await import(`@/messages/${locale}/dashboard.json`)).default,
    (await import(`@/messages/${locale}/meetings.json`)).default,
    (await import(`@/messages/${locale}/meetings.list.json`)).default,
    (await import(`@/messages/${locale}/meetings.detail.json`)).default,
    (await import(`@/messages/${locale}/projects.json`)).default,
    (await import(`@/messages/${locale}/projects.list.json`)).default,
    (await import(`@/messages/${locale}/projects.detail.json`)).default,
    (await import(`@/messages/${locale}/goals.json`)).default,
    (await import(`@/messages/${locale}/agent.json`)).default,
    (await import(`@/messages/${locale}/widgets.json`)).default,
    (await import(`@/messages/${locale}/schedule.json`)).default,
    (await import(`@/messages/${locale}/admin.json`)).default,
  );

  return {
    locale,
    messages
  };
});
