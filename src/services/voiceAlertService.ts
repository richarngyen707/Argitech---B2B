import { SupportedLanguage } from '../types';

const langCodeMap: Record<SupportedLanguage, string> = {
  en: 'en-US',
  vi: 'vi-VN',
  es: 'es-ES',
  fr: 'fr-FR',
  zh: 'zh-CN',
  pt: 'pt-BR',
};

/**
 * Announces critical safety and operational alerts out loud via browser SpeechSynthesis API.
 * Safely guards against missing SpeechSynthesis or user interaction restrictions.
 */
export function playVoiceAlert(text: string, language: SupportedLanguage = 'en'): void {
  try {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    // Cancel any ongoing speech so critical alert is heard immediately
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCodeMap[language] || 'en-US';
    utterance.rate = 1.05; // Crisp, clear announcement pace
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    window.speechSynthesis.speak(utterance);
  } catch {
    // Speech synthesis failure is safely ignored
  }
}
