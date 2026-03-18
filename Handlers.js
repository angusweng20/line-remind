/**
 * HANDLERS & LOGIC
 */

function handleMessage(event) {
  const userId = event.source.userId;
  const sourceType = event.source.type;
  const targetId = (sourceType === 'group') ? event.source.groupId : 
                   (sourceType === 'room') ? event.source.roomId : userId;
  
  const userMsg = event.message.text.trim();
  const replyToken = event.replyToken;
  
  // Cache for State Management
  const cache = CacheService.getScriptCache();
  const stateKey = `state_${userId}`; 
  const dataKey = `data_${userId}`; 
  const isHelpCommand = userMsg.match(/^(說明|help|功能)$/i);
  const isReminderCommand = userMsg.startsWith('要記得');
  const isQueryCommand = userMsg.match(/^(查詢|查詢提醒)$/);

  if (userMsg.match(/^取消$/)) {
    cache.remove(stateKey);
    cache.remove(dataKey);
    replyText(replyToken, "已取消目前的設定 👌");
    return;
  }
  
  // 2. Cancellation by ID (Special Syntax: "取消 #123")
  const cancelMatch = userMsg.match(/^取消\s*#([^\s]+)$/);
  if (cancelMatch) {
     const rowId = cancelMatch[1];
     const success = Database.cancelReminder(rowId);
     if (success) {
       replyText(replyToken, `✅ 提醒 #${rowId} 已刪除！`);
     } else {
       replyText(replyToken, `❌ 找不到或無法刪除該提醒 #${rowId}`);
     }
     return;
  }

  // 2b. Postpone reminder ("延後 #xxx" or "延後 #xxx 10分鐘")
  const postponeMatch = userMsg.match(/^延後\s*#([^\s]+)(?:\s+(\d+)\s*分鐘?)?$/);
  if (postponeMatch) {
    const reminderId = postponeMatch[1];
    const minutes = parseInt(postponeMatch[2]) || 10;
    const result = Database.postponeReminder(reminderId, minutes);
    if (result.success) {
      replyText(replyToken, `⏰ 提醒 #${reminderId} 已延後 ${minutes} 分鐘！`);
    } else {
      replyText(replyToken, `❌ 無法延後提醒 #${reminderId}`);
    }
    return;
  }

  // 2c. Complete reminder ("完成 #xxx")
  const completeMatch = userMsg.match(/^完成\s*#([^\s]+)$/);
  if (completeMatch) {
    const reminderId = completeMatch[1];
    const result = Database.completeReminder(reminderId);
    if (result.success) {
      replyText(replyToken, `✅ 提醒 #${reminderId} 已標記完成！`);
    } else {
      replyText(replyToken, `❌ 無法完成提醒 #${reminderId}`);
    }
    return;
  }

  const currentState = cache.get(stateKey);
  if (currentState && (isHelpCommand || isReminderCommand || isQueryCommand)) {
    cache.remove(stateKey);
    cache.remove(dataKey);
  }
  if (currentState && !isHelpCommand && !isReminderCommand && !isQueryCommand) {
    processStateFlow(currentState, userId, targetId, sourceType, userMsg, replyToken, cache, stateKey, dataKey);
    return;
  }

  if (isHelpCommand) {
    const flex = createHelpFlex();
    replyMessage(replyToken, [ { type: "flex", altText: "使用說明", contents: flex } ]);

  } else if (isReminderCommand) {
    const initData = {
        targetId: targetId,
        targetType: (sourceType === 'group') ? 'GROUP' : 'USER'
    };
    cache.put(dataKey, JSON.stringify(initData), 600);

    let restText = userMsg.substring(3).trim();

    if (restText.length > 0) {
       cache.put(stateKey, 'WAITING_INFO', 600);
       processStateFlow('WAITING_INFO', userId, targetId, sourceType, restText, replyToken, cache, stateKey, dataKey);
       return; 
    }

    cache.put(stateKey, 'WAITING_INFO', 600); 
    replyText(replyToken, "收到！請告訴我「時間」與「要記得的事」！\n(例如：明天下午兩點 開會、每週五交週報)");
  
  } else if (isQueryCommand) {
    doQuery(targetId, replyToken);
  } else {
    replyText(replyToken, "你可以這樣使用：\n要記得 明天 9點 開會\n查詢");
  }
}

function processStateFlow(state, userId, targetId, sourceType, input, replyToken, cache, stateKey, dataKey) {
  let cachedData = JSON.parse(cache.get(dataKey));
  if (!cachedData) cachedData = {};

  if (state === 'WAITING_INFO') {
    // Try to parse Time AND Content
    const timeObj = parseTimeInput(input);
    const content = extractContent(input);
    
    // Case 1: Time found
    if (timeObj) {
        // If content is empty (e.g. user just said "明天 9點"), ask for content
        if (!content || content.length === 0) {
            cachedData.timeObj = timeObj; // Store temp
            cache.put(dataKey, JSON.stringify(cachedData), 600);
            cache.put(stateKey, 'WAITING_CONTENT_ONLY', 600);
            replyText(replyToken, `時間是 ${Utilities.formatDate(timeObj.nextRun, "GMT+8", "HH:mm")}，那內容是什麼呢？`);
            return;
        }

        // Time AND Content found -> Save directly!
        saveReminder(userId, cachedData, content, timeObj, replyToken, cache, stateKey, dataKey);
    } 
    // Case 2: Time NOT found, assume input is Content
    else {
        cachedData.content = input;
        cache.put(dataKey, JSON.stringify(cachedData), 600);
        cache.put(stateKey, 'WAITING_TIME_ONLY', 600);
        
        replyText(replyToken, `了解「${input}」👌 那時間呢？\n(例如：明天下午兩點)`);
    }

  } else if (state === 'WAITING_CONTENT_ONLY') {
      // User already provided time, now providing content
      const content = input;
      const timeObj = cachedData.timeObj; // Retrieve saved time
      
      // Need to re-hydrate Date object from JSON
      timeObj.nextRun = new Date(timeObj.nextRun);

      saveReminder(userId, cachedData, content, timeObj, replyToken, cache, stateKey, dataKey);

  } else if (state === 'WAITING_TIME_ONLY') {
    // User already provided content, now providing time
    const timeObj = parseTimeInput(input);
    if (!timeObj) {
      replyText(replyToken, "時間格式好像怪怪的 😵 請再試一次\n範例：明天早上9點、每週一 10:00");
      return;
    }
    
    // Retrieve saved content
    const content = cachedData.content;

    saveReminder(userId, cachedData, content, timeObj, replyToken, cache, stateKey, dataKey);
  }
}

function saveReminder(userId, cachedData, content, timeObj, replyToken, cache, stateKey, dataKey) {
    const freqChinese = FREQ_MAP_REVERSE[timeObj.frequency] || '單次';
    const profile = getUserProfile(userId);
    const creatorName = profile.displayName || '未知';
    const maxRuns = timeObj.frequency === 'ONCE' ? 1 : 0;

    const targetName = (cachedData.targetType === 'GROUP') ? '此群組' : creatorName;
    const category = AIClassifier.classify(content);
    const result = Database.addReminder({
       status: 'pending',
       nextRun: timeObj.nextRun,
       freq: freqChinese, 
       content: content,
       targetId: cachedData.targetId,
       targetType: cachedData.targetType,
       creatorId: userId,
       creatorLineUserId: userId,
       category: category,
       runCount: 0,
        maxRuns: maxRuns,
       planCode: 'OSS'
    });

    if (!result || !result.success) {
      cache.remove(stateKey);
      cache.remove(dataKey);
      replyText(replyToken, "❌ 提醒儲存失敗，請稍後再試一次。");
      return;
    }
    
    cache.remove(stateKey);
    cache.remove(dataKey);
    
    const timeStr = Utilities.formatDate(timeObj.nextRun, "GMT+8", "yyyy-MM-dd HH:mm");
    const flex = createConfirmFlex({
        timeStr: timeStr,
        freq: freqChinese,
        targetName: targetName,
        content: content,
        category: category,
        maxRuns: maxRuns
    });
    
    replyMessage(replyToken, [ { type: "flex", altText: "設定完成", contents: flex } ]);
}

function doQuery(targetId, replyToken) {
  const reminders = Database.getActiveRemindersForUser(targetId);
  
  if (reminders.length === 0) {
      replyText(replyToken, "目前沒有待辦事項喔！✨");
      return;
  }
  
  // Convert to View Models
  const viewModels = reminders.map(r => ({
      id: r.id,
      content: r.content,
      category: r.category || 'other',
      dateStr: Utilities.formatDate(r.runTime, "GMT+8", "MM/dd HH:mm") + (r.freq !== '單次' ? ` (${r.freq})` : '')
  }));
  
  const flex = createReminderListFlex(viewModels);
  replyMessage(replyToken, [ { type: "flex", altText: "待辦清單", contents: flex } ]);
}
