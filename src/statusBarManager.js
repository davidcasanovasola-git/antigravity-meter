const vscode = require('vscode');
const i18n = require('./i18n');

class StatusBarManager {
  constructor() {
    // Se coloca a la derecha con prioridad moderada
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'antigravityMeter.refresh';
    this.statusBarItem.name = 'Antigravity Meter';
    this.statusBarItem.text = '$(sync~spin) Antigravity...';
    this.statusBarItem.tooltip = i18n.t('connecting');
  }

  show() {
    this.statusBarItem.show();
  }

  hide() {
    this.statusBarItem.hide();
  }

  dispose() {
    this.statusBarItem.dispose();
  }

  setLoading() {
    this.statusBarItem.text = '$(sync~spin) Antigravity...';
    this.statusBarItem.backgroundColor = undefined;
  }

  setConnecting(text = '') {
    this.statusBarItem.text = `$(sync~spin) ${text || i18n.t('connecting')}`;
    this.statusBarItem.tooltip = i18n.t('connecting');
    this.statusBarItem.backgroundColor = undefined;
  }

  setRetrying(message = '') {
    this.statusBarItem.text = `$(warning) Quota: ${message || i18n.t('notAvailable')}`;
    const md = new vscode.MarkdownString('', true);
    md.isTrusted = true;
    md.appendMarkdown(`${i18n.t('retryTooltipHeader')}\n\n`);
    md.appendMarkdown(`${i18n.t('retryTooltipBody')}`);
    this.statusBarItem.tooltip = md;
    this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
  }

  setError(message = '') {
    this.statusBarItem.text = `$(alert) Quota: ${message || i18n.t('notConnected')}`;
    this.statusBarItem.tooltip = new vscode.MarkdownString(
      `${i18n.t('retryTooltipHeader')}\n\n${i18n.t('retryTooltipBody')}`
    );
    this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
  }

  /**
   * Actualiza el status bar con los grupos de modelos y los umbrales configurados.
   *
   * @param {Array} groups - Lista de grupos normalizados (Gemini, Claude)
   * @param {Object} options - { warningThreshold, criticalThreshold, showResetTime }
   */
  update(groups, { warningThreshold = 40, criticalThreshold = 20, showResetTime = 'both' } = {}) {
    if (!groups || groups.length === 0) {
      this.setError(i18n.t('noData'));
      return;
    }

    const mode = this._normalizeResetTimeMode(showResetTime);
    const segments = [];
    let hasCritical = false;
    let hasWarning = false;
    const weeklyLabel = i18n.t('weeklyShort');

    for (const g of groups) {
      const eff = g.effectivePct;
      const emoji = this._getHealthEmoji(eff, warningThreshold, criticalThreshold);

      if (eff < criticalThreshold) {
        hasCritical = true;
      } else if (eff < warningThreshold) {
        hasWarning = true;
      }

      // 5h porcentaje y tiempo restante
      const show5hTime = (mode === 'both' || mode === '5h') && g.limit5h?.countdown && g.limit5h.countdown !== 'Listo' && g.limit5h.countdown !== 'Ready';
      const time5hStr = show5hTime ? ` (${g.limit5h.countdown})` : '';
      const pct5hStr = g.limit5h ? `${g.limit5h.remainingPct}%${time5hStr}` : 'N/A';

      // Semanal porcentaje y tiempo restante
      const showWeeklyTime = (mode === 'both' || mode === 'weekly') && g.limitWeekly?.countdown && g.limitWeekly.countdown !== 'Listo' && g.limitWeekly.countdown !== 'Ready';
      const timeWeeklyStr = showWeeklyTime ? ` (${g.limitWeekly.countdown})` : '';

      let groupText = '';
      if (mode === 'both' || mode === 'weekly') {
        if (g.limitWeekly) {
          groupText = `${emoji} ${g.shortName}: ${pct5hStr} · ${weeklyLabel}: ${g.limitWeekly.remainingPct}%${timeWeeklyStr}`;
        } else {
          groupText = `${emoji} ${g.shortName}: ${pct5hStr}`;
        }
      } else {
        // Modo 'none' o '5h'
        const weeklyPart = g.limitWeekly ? ` (${weeklyLabel}: ${g.limitWeekly.remainingPct}%)` : '';
        groupText = `${emoji} ${g.shortName}: ${pct5hStr}${weeklyPart}`;
      }

      segments.push(groupText);
    }

    this.statusBarItem.text = segments.join('  |  ');

    // Color del fondo del elemento del status bar
    if (hasCritical) {
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    } else if (hasWarning) {
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
      this.statusBarItem.backgroundColor = undefined;
    }

    // Construir tooltip Markdown enriquecido
    this.statusBarItem.tooltip = this._buildTooltip(groups, warningThreshold, criticalThreshold);
  }

  _normalizeResetTimeMode(val) {
    if (val === true || val === 'true') return 'both';
    if (val === false || val === 'false') return 'none';
    if (['both', '5h', 'weekly', 'none'].includes(val)) return val;
    return 'both';
  }

  _getHealthEmoji(percentage, warning, critical) {
    if (percentage < critical) return '🔴';
    if (percentage < warning) return '🟡';
    return '🟢';
  }

  _buildTooltip(groups, warningThreshold, criticalThreshold) {
    const md = new vscode.MarkdownString('', true);
    md.isTrusted = true;
    md.supportHtml = true;

    md.appendMarkdown(`### ⏱️ Antigravity Meter\n\n`);

    const readyText = i18n.t('ready');
    const localText = i18n.t('localTime');

    for (const g of groups) {
      const icon = g.id === 'gemini' ? '💎' : (g.id === 'claude' ? '🧠' : '🤖');
      const effEmoji = this._getHealthEmoji(g.effectivePct, warningThreshold, criticalThreshold);

      md.appendMarkdown(`#### ${icon} ${g.displayName} ${effEmoji}\n`);

      if (g.limit5h) {
        const resetFormatted = this._formatResetTime(g.limit5h.resetTime, localText);
        const isReady = g.limit5h.countdown === 'Listo' || g.limit5h.countdown === 'Ready';
        const timeInfo = !isReady ? ` (${i18n.t('resetsIn', `**${g.limit5h.countdown}**`)} · ${resetFormatted})` : ` (${readyText})`;
        md.appendMarkdown(`- **${i18n.t('fiveHourWindow')}:** **${g.limit5h.remainingPct}%**${timeInfo}\n`);
      }

      if (g.limitWeekly) {
        const resetFormatted = this._formatResetTime(g.limitWeekly.resetTime, localText);
        const isReady = g.limitWeekly.countdown === 'Listo' || g.limitWeekly.countdown === 'Ready';
        const timeInfo = !isReady ? ` (${i18n.t('resetsIn', `**${g.limitWeekly.countdown}**`)} · ${resetFormatted})` : ` (${readyText})`;
        md.appendMarkdown(`- **${i18n.t('weeklyLimit')}:** **${g.limitWeekly.remainingPct}%**${timeInfo}\n`);
      }

      md.appendMarkdown(`\n`);
    }

    md.appendMarkdown(`---\n`);
    md.appendMarkdown(`*${i18n.t('thresholdsInfo', warningThreshold, criticalThreshold)}*\n\n`);
    md.appendMarkdown(`*${i18n.t('clickToRefresh')}*`);

    return md;
  }

  _formatResetTime(isoString, localLabel = 'local') {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return '';
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (isToday) {
        return `${timeStr} ${localLabel}`;
      }
      const dateStr = date.toLocaleDateString([], { day: '2-digit', month: 'short' });
      return `${dateStr} ${timeStr} ${localLabel}`;
    } catch {
      return '';
    }
  }
}

module.exports = { StatusBarManager };

