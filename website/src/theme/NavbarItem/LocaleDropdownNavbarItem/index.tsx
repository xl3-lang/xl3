/**
 * Docusaurus' default locale dropdown derives the alternate URL by replacing
 * the current locale baseUrl. In local dev and in some single-locale builds the
 * active baseUrl can be `/`, so paths like `/ko/guides` keep their locale
 * prefix and repeated language clicks become `/ko//ko/guides`.
 */
import React, {type ReactNode} from 'react';
import {translate} from '@docusaurus/Translate';
import {useLocation} from '@docusaurus/router';
import {mergeSearchStrings, useHistorySelector} from '@docusaurus/theme-common';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import DropdownNavbarItem from '@theme/NavbarItem/DropdownNavbarItem';
import IconLanguage from '@theme/Icon/Language';
import type {LinkLikeNavbarItemProps} from '@theme/NavbarItem';
import type {Props} from '@theme/NavbarItem/LocaleDropdownNavbarItem';

import styles from './styles.module.css';

function normalizePathname(pathname: string): string {
  const normalized = `/${pathname}`.replace(/\/+/g, '/');
  return normalized.length > 1 ? normalized.replace(/\/$/, '') : normalized;
}

function stripLocalePrefix(pathname: string, localeBaseUrls: string[]): string {
  let suffix = normalizePathname(pathname);
  let changed = true;

  while (changed) {
    changed = false;

    for (const baseUrl of localeBaseUrls) {
      const prefix = normalizePathname(baseUrl);
      if (prefix === '/') {
        continue;
      }

      if (suffix === prefix) {
        suffix = '/';
        changed = true;
        break;
      }

      if (suffix.startsWith(`${prefix}/`)) {
        suffix = normalizePathname(suffix.slice(prefix.length));
        changed = true;
        break;
      }
    }
  }

  return suffix;
}

function localizePathname(baseUrl: string, suffix: string): string {
  const normalizedBase = normalizePathname(baseUrl);
  const normalizedSuffix = normalizePathname(suffix);

  if (normalizedBase === '/') {
    return normalizedSuffix;
  }

  return normalizedSuffix === '/'
    ? `${normalizedBase}/`
    : `${normalizedBase}${normalizedSuffix}`;
}

function useLocaleDropdownUtils() {
  const {
    siteConfig,
    i18n: {localeConfigs},
  } = useDocusaurusContext();
  const {pathname} = useLocation();
  const search = useHistorySelector((history) => history.location.search);
  const hash = useHistorySelector((history) => history.location.hash);

  const localeBaseUrls = Object.values(localeConfigs).map(
    (localeConfig) => localeConfig.baseUrl ?? '/',
  );
  const pathnameSuffix = stripLocalePrefix(pathname, localeBaseUrls);

  const getLocaleConfig = (locale: string) => {
    const localeConfig = localeConfigs[locale];
    if (!localeConfig) {
      throw new Error(
        `Docusaurus bug, no locale config found for locale=${locale}`,
      );
    }
    return localeConfig;
  };

  const getBaseURLForLocale = (locale: string) => {
    const localeConfig = getLocaleConfig(locale);
    const localizedPath = localizePathname(
      localeConfig.baseUrl ?? '/',
      pathnameSuffix,
    );

    if (localeConfig.url === siteConfig.url) {
      return `pathname://${localizedPath}`;
    }

    return `${localeConfig.url}${localizedPath}`;
  };

  return {
    getURL: (locale: string, options: {queryString: string | undefined}) => {
      const finalSearch = mergeSearchStrings(
        [search, options.queryString],
        'append',
      );
      return `${getBaseURLForLocale(locale)}${finalSearch}${hash}`;
    },
    getLabel: (locale: string) => getLocaleConfig(locale).label,
    getLang: (locale: string) => getLocaleConfig(locale).htmlLang,
  };
}

export default function LocaleDropdownNavbarItem({
  mobile,
  dropdownItemsBefore = [],
  dropdownItemsAfter = [],
  queryString,
  ...props
}: Props): ReactNode {
  const utils = useLocaleDropdownUtils();
  const {
    i18n: {currentLocale, locales},
  } = useDocusaurusContext();

  const localeItems = locales.map((locale): LinkLikeNavbarItemProps => ({
    label: utils.getLabel(locale),
    lang: utils.getLang(locale),
    to: utils.getURL(locale, {queryString}),
    target: '_self',
    autoAddBaseUrl: false,
    className:
      locale === currentLocale
        ? mobile
          ? 'menu__link--active'
          : 'dropdown__link--active'
        : '',
  }));

  const dropdownLabel = mobile
    ? translate({
        message: 'Languages',
        id: 'theme.navbar.mobileLanguageDropdown.label',
        description: 'The label for the mobile language switcher dropdown',
      })
    : utils.getLabel(currentLocale);

  return (
    <DropdownNavbarItem
      {...props}
      mobile={mobile}
      label={
        <>
          <IconLanguage className={styles.iconLanguage} />
          {dropdownLabel}
        </>
      }
      items={[...dropdownItemsBefore, ...localeItems, ...dropdownItemsAfter]}
    />
  );
}
