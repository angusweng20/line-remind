/**
 * DATABASE
 *
 * OSS version backed by Google Sheets only.
 */

const REMINDER_COLUMNS = [
  'id',
  'line_user_id',
  'creator_line_user_id',
  'content',
  'category',
  'scheduled_at',
  'frequency',
  'run_count',
  'max_runs',
  'status',
  'created_at',
  'updated_at'
];

const Database = {
  init: function() {
    this.ensureReminderSheet();
    return true;
  },

  getSpreadsheet: function() {
    const id = CONFIG.SHEET_ID;
    return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  },

  ensureReminderSheet: function() {
    const spreadsheet = this.getSpreadsheet();
    let sheet = spreadsheet.getSheetByName(SHEETS.REMINDERS);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(SHEETS.REMINDERS);
    }

    const lastRow = sheet.getLastRow();
    if (lastRow === 0) {
      sheet.appendRow(REMINDER_COLUMNS);
      return sheet;
    }

    const currentHeaders = sheet.getRange(1, 1, 1, REMINDER_COLUMNS.length).getValues()[0];
    const needsUpdate = REMINDER_COLUMNS.some(function(header, index) {
      return currentHeaders[index] !== header;
    });
    if (needsUpdate) {
      sheet.getRange(1, 1, 1, REMINDER_COLUMNS.length).setValues([REMINDER_COLUMNS]);
    }

    return sheet;
  },

  getReminderRows: function() {
    const sheet = this.ensureReminderSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return [];
    }

    const values = sheet.getRange(2, 1, lastRow - 1, REMINDER_COLUMNS.length).getValues();
    return values.map(function(row, index) {
      const item = { _rowIndex: index + 2 };
      REMINDER_COLUMNS.forEach(function(header, headerIndex) {
        item[header] = row[headerIndex];
      });
      return item;
    });
  },

  updateReminderRow: function(rowIndex, patch) {
    const sheet = this.ensureReminderSheet();
    const currentValues = sheet.getRange(rowIndex, 1, 1, REMINDER_COLUMNS.length).getValues()[0];
    const nextValues = REMINDER_COLUMNS.map(function(header, index) {
      return Object.prototype.hasOwnProperty.call(patch, header) ? patch[header] : currentValues[index];
    });
    sheet.getRange(rowIndex, 1, 1, REMINDER_COLUMNS.length).setValues([nextValues]);
    return { success: true };
  },

  addReminder: function(reminderData) {
    const sheet = this.ensureReminderSheet();
    const nowIso = new Date().toISOString();
    sheet.appendRow([
      Utilities.getUuid(),
      reminderData.targetId,
      reminderData.creatorLineUserId || reminderData.targetId,
      reminderData.content,
      reminderData.category || 'other',
      reminderData.nextRun.toISOString(),
      FREQ_MAP[reminderData.freq] || 'ONCE',
      reminderData.runCount || 0,
      reminderData.maxRuns || '',
      'pending',
      nowIso,
      nowIso
    ]);
    return { success: true };
  },

  getActiveRemindersForUser: function(targetId) {
    return this.getReminderRows()
      .filter(function(row) {
        return row.line_user_id === targetId && row.status === 'pending';
      })
      .sort(function(a, b) {
        return String(a.scheduled_at || '').localeCompare(String(b.scheduled_at || ''));
      })
      .map(function(row) {
        return {
          id: row.id,
          rowIndex: row._rowIndex,
          runTime: new Date(row.scheduled_at),
          content: row.content,
          freq: FREQ_MAP_REVERSE[row.frequency] || '單次',
          category: row.category
        };
      });
  },

  getDueReminders: function() {
    const now = new Date();
    const rows = this.getReminderRows().filter(function(row) {
      return row.status === 'pending' && row.scheduled_at && new Date(row.scheduled_at) <= now;
    });
    return { success: true, data: rows };
  },

  getReminderById: function(id) {
    return this.getReminderRows().find(function(row) {
      return String(row.id) === String(id);
    }) || null;
  },

  cancelReminder: function(id) {
    const row = this.getReminderById(id);
    if (!row) {
      return { success: false, error: 'Reminder not found' };
    }
    return this.updateReminderRow(row._rowIndex, {
      status: 'cancelled',
      updated_at: new Date().toISOString()
    });
  },

  postponeReminder: function(id, minutes) {
    const row = this.getReminderById(id);
    if (!row) {
      return { success: false, error: 'Reminder not found' };
    }
    const newTime = new Date(row.scheduled_at);
    newTime.setMinutes(newTime.getMinutes() + (minutes || 10));
    return this.updateReminderRow(row._rowIndex, {
      scheduled_at: newTime.toISOString(),
      updated_at: new Date().toISOString()
    });
  },

  completeReminder: function(id) {
    const row = this.getReminderById(id);
    if (!row) {
      return { success: false, error: 'Reminder not found' };
    }
    return this.updateReminderRow(row._rowIndex, {
      status: 'completed',
      updated_at: new Date().toISOString()
    });
  },

  updateReminderAfterRun: function(id, freqCode, nextRun, runCount, maxRuns) {
    const row = this.getReminderById(id);
    if (!row) {
      return { success: false, error: 'Reminder not found' };
    }

    const nextRunCount = Number(runCount || 0) + 1;
    const reachedRunLimit = maxRuns && Number(maxRuns) > 0 && nextRunCount >= Number(maxRuns);
    const patch = {
      run_count: nextRunCount,
      updated_at: new Date().toISOString()
    };

    if (freqCode === 'ONCE' || !freqCode || reachedRunLimit) {
      patch.status = 'completed';
    } else {
      patch.scheduled_at = nextRun.toISOString();
    }

    return this.updateReminderRow(row._rowIndex, patch);
  }
};
