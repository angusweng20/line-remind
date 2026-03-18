const AIClassifier = {
  CATEGORIES: ['work', 'health', 'personal', 'shopping', 'meeting', 'other'],
  
  classify: function(text) {
    if (!text || text.trim().length === 0) {
      return 'other';
    }
    if (/(會議|開會|討論|會談)/.test(text)) return 'meeting';
    if (/(買|購物|採買|訂單|繳費)/.test(text)) return 'shopping';
    if (/(運動|看醫生|吃藥|健康|回診)/.test(text)) return 'health';
    if (/(工作|專案|報告|客戶|上班|交付)/.test(text)) return 'work';
    if (/(家人|朋友|生活|個人|整理房間)/.test(text)) return 'personal';
    return 'other';
  }
};
