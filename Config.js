/**
 * CONFIGURATION & CONSTANTS
 */

// 1. Environment Variables (Secret)
// Use PropertiesService.getScriptProperties().getProperty('KEY') to get these.
// If not found, fall back to these defaults (for dev/testing).
const DEFAULT_CHANNEL_ACCESS_TOKEN = ''; 
const DEFAULT_SHEET_ID = ''; 
const DEFAULT_OPENAI_API_KEY = '';

function getScriptProperty(key, contentDefault = '') {
  try {
    const val = PropertiesService.getScriptProperties().getProperty(key);
    return val ? val : contentDefault;
  } catch (e) {
    return contentDefault;
  }
}

function getNumberScriptProperty(key, defaultValue) {
  const raw = getScriptProperty(key, String(defaultValue));
  const parsed = parseInt(raw, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

const CONFIG = {
  get CHANNEL_ACCESS_TOKEN() { return getScriptProperty('CHANNEL_ACCESS_TOKEN', DEFAULT_CHANNEL_ACCESS_TOKEN); },
  get SHEET_ID() { return getScriptProperty('SHEET_ID', DEFAULT_SHEET_ID); },
  get OPENAI_API_KEY() { return getScriptProperty('OPENAI_API_KEY', DEFAULT_OPENAI_API_KEY); },
  BOT_NAME: '記得',
  BOT_TONE: 'SERIOUS'
};

const FREQ_MAP = {
  '單次': 'ONCE',
  '每天': 'DAILY',
  '每週': 'WEEKLY',
  '每月': 'MONTHLY'
};

const FREQ_MAP_REVERSE = {
  'ONCE': '單次',
  'DAILY': '每天',
  'WEEKLY': '每週',
  'MONTHLY': '每月'
};

const SHEETS = {
  REMINDERS: '提醒事項'
};
