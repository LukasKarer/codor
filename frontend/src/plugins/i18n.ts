import { createI18n } from 'vue-i18n'
import de from '@/locales/de'
import en from '@/locales/en'

const savedLocale = localStorage.getItem('locale') as 'de' | 'en' | null
const browserLocale = navigator.language.toLowerCase().startsWith('en') ? 'en' : 'de'
const locale = savedLocale ?? browserLocale

export const i18n = createI18n({
  legacy: false,
  locale,
  fallbackLocale: 'en',
  messages: { de, en },
})
