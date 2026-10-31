const vscode = require('vscode');
const { QuotaService } = require('./quotaService');
const { StatusBarManager } = require('./statusBarManager');
const { NotificationService } = require('./notificationService');
const i18n = require('./i18n');

let statusBarManager = null;
let quotaService = null;
let notificationService = null;
let refreshTimer = null;
let backgroundRetryTimer = null;
let lastKnownData = null;
const lastKnownBuckets = new Map(); // key: `${groupId}:${bucketId}` -> { remainingPct, resetTime }

function getConfig() {
  const config = vscode.workspace.getConfiguration('antigravityMeter');
  const language = config.get('language', 'auto');
  i18n.setLanguage(language);

  return {
    warningThreshold: config.get('warningThreshold', 40),
    criticalThreshold: config.get('criticalThreshold', 20),
    showResetTime: config.get('showResetTime', 'both'),
    language,
    notificationsEnabled: config.get('notifications.enabled', true),
    notificationsSound: config.get('notifications.sound', true),
    notificationsSoundName: config.get('notifications.soundName', 'Glass'),
    refreshInterval: Math.max(10, config.get('refreshInterval', 60))
  };
}

/**
 * Actualiza la información de cuota.
 * @param {boolean} [silent=false] Si es true, no muestra errores visuales en el status bar (útil durante reintentos de inicio).
 * @returns {Promise<boolean>} True si se obtuvieron datos con éxito, false en caso contrario.
 */
async function updateQuota(silent = false) {
  if (!quotaService || !statusBarManager) return false;

  const config = getConfig();
  try {
    const groups = await quotaService.getQuotaSummary();
    if (groups && groups.length > 0) {
      lastKnownData = groups;
      checkQuotaResets(groups, config);
      statusBarManager.update(groups, {
        warningThreshold: config.warningThreshold,
        criticalThreshold: config.criticalThreshold,
        showResetTime: config.showResetTime
      });
      return true;
    } else {
      if (!silent) {
        statusBarManager.setError('Sin conexión');
      }
      return false;
    }
  } catch (error) {
    console.error('[Antigravity Meter] Error actualizando cuota:', error);
    if (!silent) {
      statusBarManager.setError('Error');
    }
    return false;
  }
}

/**
 * Inicia reintentos en segundo plano cada 3 segundos hasta que el servicio esté disponible.
 */
function startBackgroundRetry() {
  if (backgroundRetryTimer) {
    clearInterval(backgroundRetryTimer);
  }
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }

  backgroundRetryTimer = setInterval(async () => {
    const success = await updateQuota(true);
    if (success) {
      // Conexión restablecida con éxito
      clearInterval(backgroundRetryTimer);
      backgroundRetryTimer = null;
      const config = getConfig();
      startPolling(config.refreshInterval);
    }
  }, 3000);
}

/**
 * Conexión resiliente al inicio / reload:
 * No muestra error inmediato. Reintenta a los 0s, 1.5s, 3s y 5s de forma silenciosa.
 * Si tras ~5 segundos sigue sin responder, muestra aviso informativo y continúa reintentando de fondo.
 */
async function connectWithRetries() {
  statusBarManager.setConnecting('Antigravity...');

  const delays = [0, 1500, 1500, 2000];
  let connected = false;

  for (let i = 0; i < delays.length; i++) {
    if (delays[i] > 0) {
      await new Promise(r => setTimeout(r, delays[i]));
    }
    connected = await updateQuota(true);
    if (connected) {
      break;
    }
  }

  if (connected) {
    const config = getConfig();
    startPolling(config.refreshInterval);
  } else {
    // Tras 5 segundos sin respuesta, informar al usuario sin alarmismo
    statusBarManager.setRetrying(i18n.t('notAvailable'));
    vscode.window.setStatusBarMessage(
      i18n.t('retryingBackgroundMsg'),
      6000
    );
    startBackgroundRetry();
  }
}

/**
 * Detecta si alguna ventana de cuota se ha reseteado / recargado
 * y dispara una notificación nativa del sistema con sonido si está activado.
 */
function checkQuotaResets(groups, config) {
  if (!config.notificationsEnabled) return;

  for (const group of groups) {
    const buckets = [
      { bucket: group.limit5h, type: i18n.t('fiveHours') },
      { bucket: group.limitWeekly, type: i18n.t('weekly') }
    ];

    for (const { bucket, type } of buckets) {
      if (!bucket || !bucket.bucketId) continue;

      const key = `${group.id}:${bucket.bucketId}`;
      const prev = lastKnownBuckets.get(key);

      if (prev) {
        // Detección de reinicio:
        // 1. El porcentaje actual subió de forma neta (ej: de 30% a 100%)
        // 2. O la fecha de reseteo anterior ya pasó y cambió a una nueva fecha futura
        const prevResetPassed = prev.resetTime && new Date(prev.resetTime).getTime() <= Date.now();
        const hasIncreased = bucket.remainingPct > (prev.remainingPct + 2);
        const resetRolledOver = prevResetPassed && bucket.resetTime !== prev.resetTime && bucket.remainingPct >= prev.remainingPct;

        if (hasIncreased || resetRolledOver) {
          notificationService.sendSystemNotification({
            title: 'Antigravity Meter',
            subtitle: `${group.displayName}: ${i18n.t('quotaRestored')}`,
            message: i18n.t('windowRestoredMsg', type, bucket.remainingPct),
            sound: config.notificationsSound,
            soundName: config.notificationsSoundName
          });
        }
      }

      // Guardar estado actual
      lastKnownBuckets.set(key, {
        remainingPct: bucket.remainingPct,
        resetTime: bucket.resetTime
      });
    }
  }
}

function startPolling(intervalSeconds) {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }
  refreshTimer = setInterval(() => {
    updateQuota();
  }, intervalSeconds * 1000);
}

function activate(context) {
  statusBarManager = new StatusBarManager();
  quotaService = new QuotaService();
  notificationService = new NotificationService();

  statusBarManager.show();

  // Comando manual para refrescar
  const refreshCmd = vscode.commands.registerCommand('antigravityMeter.refresh', async () => {
    statusBarManager.setLoading();
    const success = await updateQuota(false);
    if (success && backgroundRetryTimer) {
      clearInterval(backgroundRetryTimer);
      backgroundRetryTimer = null;
      const config = getConfig();
      startPolling(config.refreshInterval);
    }
  });

  // Comando para probar únicamente el sonido seleccionado
  const testSoundCmd = vscode.commands.registerCommand('antigravityMeter.testSound', async () => {
    const config = getConfig();
    await notificationService.playSound(config.notificationsSoundName);
  });

  // Comando para probar la notificación completa de sistema y sonido
  const testNotifCmd = vscode.commands.registerCommand('antigravityMeter.testNotification', async () => {
    const config = getConfig();
    const ok = await notificationService.sendSystemNotification({
      title: 'Antigravity Meter',
      subtitle: i18n.t('testNotifSubtitle'),
      message: i18n.t('testNotifMsg'),
      sound: config.notificationsSound,
      soundName: config.notificationsSoundName
    });

    if (!ok) {
      vscode.window.showWarningMessage(i18n.t('notificationFailed'));
    }
  });

  // Escuchar cambios en la configuración
  const configWatcher = vscode.workspace.onDidChangeConfiguration(async (e) => {
    // Si cambia el idioma, actualizar el diccionario de i18n
    if (e.affectsConfiguration('antigravityMeter.language')) {
      const config = getConfig();
      i18n.setLanguage(config.language);
    }

    // Si cambia el sonido seleccionado, reproducir el nuevo sonido inmediatamente
    if (e.affectsConfiguration('antigravityMeter.notifications.soundName')) {
      const config = getConfig();
      if (config.notificationsSound) {
        await notificationService.playSound(config.notificationsSoundName);
      }
    }

    if (e.affectsConfiguration('antigravityMeter')) {
      const config = getConfig();
      startPolling(config.refreshInterval);
      if (lastKnownData) {
        statusBarManager.update(lastKnownData, {
          warningThreshold: config.warningThreshold,
          criticalThreshold: config.criticalThreshold,
          showResetTime: config.showResetTime
        });
      }
    }
  });

  context.subscriptions.push(
    statusBarManager,
    refreshCmd,
    testSoundCmd,
    testNotifCmd,
    configWatcher,
    {
      dispose: () => {
        if (refreshTimer) {
          clearInterval(refreshTimer);
          refreshTimer = null;
        }
        if (backgroundRetryTimer) {
          clearInterval(backgroundRetryTimer);
          backgroundRetryTimer = null;
        }
      }
    }
  );

  // Conexión inicial resiliente con reintentos silenciosos
  connectWithRetries();
}

function deactivate() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  if (backgroundRetryTimer) {
    clearInterval(backgroundRetryTimer);
    backgroundRetryTimer = null;
  }
  if (statusBarManager) {
    statusBarManager.dispose();
  }
}

module.exports = {
  activate,
  deactivate
};

