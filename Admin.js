/**
 * ADMIN HELPERS
 *
 * These helpers are intended to be run manually from the Apps Script editor
 * for the OSS self-hosted release.
 */

function initializeCurrentDatabase() {
  const ok = Database.init();
  if (!ok) {
    throw new Error('資料庫初始化失敗');
  }
  return '資料庫初始化完成。Provider: SHEETS';
}

function getRuntimeConfigSummary() {
  return [
    'DATABASE_PROVIDER: SHEETS',
    `SHEET_ID: ${CONFIG.SHEET_ID || '(active spreadsheet)'}`,
    'Capabilities: {"reminder":true}'
  ].join('\n');
}

function setupOpenSourceMode() {
  const ok = Database.init();
  if (!ok) {
    throw new Error('開源版初始化失敗');
  }

  setupTrigger();
  return [
    '已切換到 Google Sheets 開源模式。',
    '請確認以下設定：',
    '- CHANNEL_ACCESS_TOKEN 已設定',
    '- SHEET_ID 已設定，或目前有可用的試算表',
    '- Web App 已重新部署'
  ].join('\n');
}

function getOpenSourceSetupChecklist() {
  return [
    '1. 設定 CHANNEL_ACCESS_TOKEN',
    '2. 設定 SHEET_ID，或直接把專案綁在目標試算表',
    '3. 執行 initializeCurrentDatabase() 建立提醒事項工作表',
    '4. 執行 setupTrigger() 建立每分鐘提醒檢查',
    '5. 重新部署 GAS Web App',
    '6. 把 Web App URL 填回 LINE Webhook URL'
  ].join('\n');
}

function getOpenSourcePublishChecklist() {
  return [
    '1. 確認沒有留下任何私密 token 在程式碼中',
    '2. 執行 initializeCurrentDatabase() 建立提醒事項工作表',
    '3. 執行 getOpenSourceHealthCheck()，確認 Reminder Sheet 與 Trigger 都是 OK',
    '4. 重新部署 GAS Web App',
    '5. 更新 README 中的安裝步驟',
    '6. 用測試 LINE 帳號實測：要記得 / 查詢 / 完成 / 取消 / 延後'
  ].join('\n');
}

function getOpenSourceHealthCheck() {
  const triggers = ScriptApp.getProjectTriggers();
  const triggerReady = triggers.some(function(trigger) {
    return trigger.getHandlerFunction() === 'checkReminders';
  });

  const spreadsheet = CONFIG.SHEET_ID
    ? SpreadsheetApp.openById(CONFIG.SHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
  const reminderSheet = spreadsheet.getSheetByName('提醒事項');

  return [
    'DATABASE_PROVIDER: SHEETS',
    `Spreadsheet: ${spreadsheet.getId()}`,
    `Reminder Sheet: ${reminderSheet ? 'OK' : 'MISSING'}`,
    `Trigger checkReminders: ${triggerReady ? 'OK' : 'MISSING'}`
  ].join('\n');
}
