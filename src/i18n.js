let vscode;
try {
  vscode = require('vscode');
} catch { }
const cp = require('child_process');
const os = require('os');

const DICTIONARIES = {
  en: {
    weeklyShort: 'Wk',
    fiveHourShort: '5h',
    connecting: 'Antigravity...',
    notConnected: 'Not connected',
    notAvailable: 'Not available',
    noData: 'No data',
    error: 'Error',
    ready: 'Ready',
    weeklyLimit: 'Weekly Limit',
    fiveHourWindow: '5-Hour Window',
    remaining: 'remaining',
    resetsIn: 'resets in {0}',
    localTime: 'local',
    thresholdsInfo: 'Configured thresholds: 🟢 Normal ≥ {0}% · 🟡 Warning < {0}% · 🔴 Critical < {1}%',
    clickToRefresh: 'Click to refresh.',
    retryTooltipHeader: '### ⚠️ Antigravity Meter',
    retryTooltipBody: 'Could not load quota information on startup.\n\nThe Antigravity language server might be starting in the background.\n\n*Retrying automatically in the background...*\n\n*Click to retry manually.*',
    retryingBackgroundMsg: '$(info) Antigravity Meter: Could not connect on startup. Retrying in background...',
    quotaRestored: 'Quota restored',
    windowRestoredMsg: 'The {0} window has reset to {1}%.',
    fiveHours: '5 Hours',
    weekly: 'Weekly',
    testNotifSubtitle: 'Sound and notification test',
    testNotifMsg: 'Antigravity Meter notification system is working properly!'
  },
  es: {
    weeklyShort: 'Sem',
    fiveHourShort: '5h',
    connecting: 'Antigravity...',
    notConnected: 'No conectado',
    notAvailable: 'No disponible',
    noData: 'Sin datos',
    error: 'Error',
    ready: 'Listo',
    weeklyLimit: 'Límite Semanal',
    fiveHourWindow: 'Ventana 5h',
    remaining: 'restante',
    resetsIn: 'reinicia en {0}',
    localTime: 'local',
    thresholdsInfo: 'Márgenes configurados: 🟢 Normal ≥ {0}% · 🟡 Aviso < {0}% · 🔴 Crítico < {1}%',
    clickToRefresh: 'Haz clic para actualizar.',
    retryTooltipHeader: '### ⚠️ Antigravity Meter',
    retryTooltipBody: 'No se ha podido cargar la información de cuota en el inicio.\n\nEl servidor de lenguaje de Antigravity puede estar iniciando en segundo plano.\n\n*Reintentando de fondo automáticamente...*\n\n*Haz clic para forzar comprobación manual.*',
    retryingBackgroundMsg: '$(info) Antigravity Meter: No se pudo conectar al inicio. Reintentando en segundo plano...',
    quotaRestored: 'Cuota restablecida',
    windowRestoredMsg: 'La ventana de {0} se ha restablecido al {1}%.',
    fiveHours: '5 Horas',
    weekly: 'Semanal',
    testNotifSubtitle: 'Prueba de sonido y notificación',
    testNotifMsg: '¡El sistema de notificaciones de Antigravity Meter está funcionando correctamente!'
  },
  fr: {
    weeklyShort: 'Hebdo',
    fiveHourShort: '5h',
    connecting: 'Antigravity...',
    notConnected: 'Non connecté',
    notAvailable: 'Indisponible',
    noData: 'Aucune donnée',
    error: 'Erreur',
    ready: 'Prêt',
    weeklyLimit: 'Limite Hebdomadaire',
    fiveHourWindow: 'Fenêtre 5h',
    remaining: 'restant',
    resetsIn: 'réinitialisation dans {0}',
    localTime: 'local',
    thresholdsInfo: 'Seuils configurés: 🟢 Normal ≥ {0}% · 🟡 Avertissement < {0}% · 🔴 Critique < {1}%',
    clickToRefresh: 'Cliquez pour actualiser.',
    retryTooltipHeader: '### ⚠️ Antigravity Meter',
    retryTooltipBody: 'Impossible de charger le quota au démarrage.\n\nLe serveur Antigravity démarre peut-être en arrière-plan.\n\n*Nouvelle tentative automatique en cours...*\n\n*Cliquez pour réessayer manuellement.*',
    retryingBackgroundMsg: '$(info) Antigravity Meter: Connexion en cours en arrière-plan...',
    quotaRestored: 'Quota restauré',
    windowRestoredMsg: 'La fenêtre {0} a été restaurée à {1}%.',
    fiveHours: '5 Heures',
    weekly: 'Hebdomadaire',
    testNotifSubtitle: 'Test de son et notification',
    testNotifMsg: 'Le système de notification d\'Antigravity Meter fonctionne correctement !'
  },
  de: {
    weeklyShort: 'Wöch',
    fiveHourShort: '5h',
    connecting: 'Antigravity...',
    notConnected: 'Nicht verbunden',
    notAvailable: 'Nicht verfügbar',
    noData: 'Keine Daten',
    error: 'Fehler',
    ready: 'Bereit',
    weeklyLimit: 'Wöchentliches Limit',
    fiveHourWindow: '5-Stunden-Fenster',
    remaining: 'verbleibend',
    resetsIn: 'wird in {0} zurückgesetzt',
    localTime: 'lokal',
    thresholdsInfo: 'Konfigurierte Schwellenwerte: 🟢 Normal ≥ {0}% · 🟡 Warnung < {0}% · 🔴 Kritisch < {1}%',
    clickToRefresh: 'Klicken zum Aktualisieren.',
    retryTooltipHeader: '### ⚠️ Antigravity Meter',
    retryTooltipBody: 'Kontingentinformationen konnten beim Start nicht geladen werden.\n\nDer Language Server startet möglicherweise noch.\n\n*Automatischer Neuversuch im Hintergrund...*\n\n*Klicken für manuellen Neuversuch.*',
    retryingBackgroundMsg: '$(info) Antigravity Meter: Verbindungsaufbau im Hintergrund...',
    quotaRestored: 'Kontingent zurückgesetzt',
    windowRestoredMsg: 'Das {0}-Fenster wurde auf {1}% zurückgesetzt.',
    fiveHours: '5 Stunden',
    weekly: 'Wöchentlich',
    testNotifSubtitle: 'Sound- und Benachrichtigungstest',
    testNotifMsg: 'Das Antigravity Meter Benachrichtigungssystem funktioniert einwandfrei!'
  },
  'zh-cn': {
    weeklyShort: '周限',
    fiveHourShort: '5h',
    connecting: 'Antigravity 连接中...',
    notConnected: '未连接',
    notAvailable: '不可用',
    noData: '无数据',
    error: '错误',
    ready: '已就绪',
    weeklyLimit: '每周配额上限',
    fiveHourWindow: '5小时时间窗',
    remaining: '剩余',
    resetsIn: '{0} 后刷新',
    localTime: '本地时间',
    thresholdsInfo: '配置阈值：🟢 正常 ≥ {0}% · 🟡 预警 < {0}% · 🔴 紧急 < {1}%',
    clickToRefresh: '点击立即刷新。',
    retryTooltipHeader: '### ⚠️ Antigravity Meter',
    retryTooltipBody: '启动时未能加载配额信息。\n\nAntigravity 语言服务器可能正在后台启动。\n\n*正在后台自动重试...*\n\n*点击可手动重试。*',
    retryingBackgroundMsg: '$(info) Antigravity Meter: 启动时未连接，正在后台重试...',
    quotaRestored: '配额已恢复',
    windowRestoredMsg: '{0} 窗口已重置为 {1}%。',
    fiveHours: '5小时',
    weekly: '每周',
    testNotifSubtitle: '声音与通知测试',
    testNotifMsg: 'Antigravity Meter 通知系统运行正常！'
  },
  ja: {
    weeklyShort: '週間',
    fiveHourShort: '5h',
    connecting: 'Antigravity 接続中...',
    notConnected: '未接続',
    notAvailable: '利用不可',
    noData: 'データなし',
    error: 'エラー',
    ready: '完了',
    weeklyLimit: '週間制限',
    fiveHourWindow: '5時間ウィンドウ',
    remaining: '残り',
    resetsIn: '{0} 後にリセット',
    localTime: '現地時間',
    thresholdsInfo: '設定閾値: 🟢 正常 ≥ {0}% · 🟡 警告 < {0}% · 🔴 危機 < {1}%',
    clickToRefresh: 'クリックして更新。',
    retryTooltipHeader: '### ⚠️ Antigravity Meter',
    retryTooltipBody: '起動時にクォータ情報を取得できませんでした。\n\nバックグラウンドで起動中の可能性があります。\n\n*自動的に再試行中...*\n\n*クリックして手動再試行。*',
    retryingBackgroundMsg: '$(info) Antigravity Meter: 接続を再試行しています...',
    quotaRestored: 'クォータ回復',
    windowRestoredMsg: '{0} ウィンドウが {1}% にリセットされました。',
    fiveHours: '5時間',
    weekly: '週間',
    testNotifSubtitle: '通知とサウンドのテスト',
    testNotifMsg: 'Antigravity Meter の通知システムは正常に動作しています！'
  },
  'pt-br': {
    weeklyShort: 'Sem',
    fiveHourShort: '5h',
    connecting: 'Antigravity...',
    notConnected: 'Não conectado',
    notAvailable: 'Indisponível',
    noData: 'Sem dados',
    error: 'Erro',
    ready: 'Pronto',
    weeklyLimit: 'Limite Semanal',
    fiveHourWindow: 'Janela de 5h',
    remaining: 'restante',
    resetsIn: 'reinicia em {0}',
    localTime: 'local',
    thresholdsInfo: 'Limiares configurados: 🟢 Normal ≥ {0}% · 🟡 Aviso < {0}% · 🔴 Crítico < {1}%',
    clickToRefresh: 'Clique para atualizar.',
    retryTooltipHeader: '### ⚠️ Antigravity Meter',
    retryTooltipBody: 'Não foi possível carregar as cotas na inicialização.\n\nO servidor de linguagem pode estar iniciando em segundo plano.\n\n*Tentando novamente em segundo plano...*\n\n*Clique para tentar manualmente.*',
    retryingBackgroundMsg: '$(info) Antigravity Meter: Tentando reconectar em segundo plano...',
    quotaRestored: 'Cota restaurada',
    windowRestoredMsg: 'A janela de {0} foi restabelecida para {1}%.',
    fiveHours: '5 Horas',
    weekly: 'Semanal',
    testNotifSubtitle: 'Teste de som e notificação',
    testNotifMsg: 'O sistema de notificações do Antigravity Meter está funcionando corretamente!'
  },
  it: {
    weeklyShort: 'Sett',
    fiveHourShort: '5h',
    connecting: 'Antigravity...',
    notConnected: 'Non connesso',
    notAvailable: 'Non disponibile',
    noData: 'Nessun dato',
    error: 'Errore',
    ready: 'Pronto',
    weeklyLimit: 'Limite Settimanale',
    fiveHourWindow: 'Finestra 5h',
    remaining: 'rimanente',
    resetsIn: 'si azzera tra {0}',
    localTime: 'locale',
    thresholdsInfo: 'Soglie configurate: 🟢 Normale ≥ {0}% · 🟡 Avviso < {0}% · 🔴 Critico < {1}%',
    clickToRefresh: 'Clicca per aggiornare.',
    retryTooltipHeader: '### ⚠️ Antigravity Meter',
    retryTooltipBody: 'Impossibile caricare le quote all\'avvio.\n\nIl server potrebbe essere in fase di avvio in background.\n\n*Nuovo tentativo in corso in background...*\n\n*Clicca per riprovare manualmente.*',
    retryingBackgroundMsg: '$(info) Antigravity Meter: Tentativo di connessione in background...',
    quotaRestored: 'Quota ripristinata',
    windowRestoredMsg: 'La finestra di {0} è stata ripristinata al {1}%.',
    fiveHours: '5 Ore',
    weekly: 'Settimanale',
    testNotifSubtitle: 'Test suono e notifica',
    testNotifMsg: 'Il sistema di notifiche di Antigravity Meter funziona correttamente!'
  }
};

let currentLanguageSetting = 'auto';

/**
 * Detecta el idioma nativo del sistema operativo o del entorno de VS Code.
 */
function detectSystemLanguage() {
  // 1. Idioma activo de VS Code / Antigravity IDE (ej: "es", "en", "zh-cn")
  if (vscode && vscode.env && vscode.env.language) {
    const l = vscode.env.language.toLowerCase();
    if (DICTIONARIES[l]) return l;
    const base = l.split('-')[0];
    if (DICTIONARIES[base]) return base;
  }

  // 2. En macOS, consultar la preferencia del sistema operativo
  if (os.platform() === 'darwin') {
    try {
      const appleLocale = cp.execSync('defaults read -g AppleLocale 2>/dev/null', { timeout: 1000 }).toString().trim();
      const code = appleLocale.split('_')[0].toLowerCase();
      if (DICTIONARIES[code]) return code;
    } catch { }
  }

  // 3. Fallback de Intl del entorno V8
  try {
    const intl = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase();
    if (DICTIONARIES[intl]) return intl;
    const base = intl.split('-')[0];
    if (DICTIONARIES[base]) return base;
  } catch { }

  return 'en';
}

function setLanguage(lang) {
  currentLanguageSetting = lang || 'auto';
}

function getEffectiveLanguage() {
  if (currentLanguageSetting && currentLanguageSetting !== 'auto') {
    const s = currentLanguageSetting.toLowerCase();
    if (DICTIONARIES[s]) return s;
    const base = s.split('-')[0];
    if (DICTIONARIES[base]) return base;
  }
  return detectSystemLanguage();
}

/**
 * Traduce una clave al idioma efectivo con sustitución posicional {0}, {1}, etc.
 */
function t(key, ...args) {
  const lang = getEffectiveLanguage();
  const dict = DICTIONARIES[lang] || DICTIONARIES.en;
  let str = dict[key] !== undefined ? dict[key] : (DICTIONARIES.en[key] !== undefined ? DICTIONARIES.en[key] : key);
  args.forEach((arg, index) => {
    str = str.replace(new RegExp(`\\{${index}\\}`, 'g'), String(arg));
  });
  return str;
}

module.exports = {
  t,
  setLanguage,
  getEffectiveLanguage,
  detectSystemLanguage
};