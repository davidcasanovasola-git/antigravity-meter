const cp = require('child_process');
const os = require('os');

class NotificationService {
  /**
   * Envía una notificación nativa del sistema operativo (no del IDE).
   * En macOS utiliza AppleScript (`osascript`) para integrarse directamente
   * con el Centro de Notificaciones del sistema y reproducir sonido nativo.
   *
   * @param {Object} options
   * @param {string} options.title - Título principal (ej: "Antigravity Meter")
   * @param {string} options.subtitle - Subtítulo (ej: "Gemini: Cuota restablecida")
   * @param {string} options.message - Mensaje detallado
   * @param {boolean} [options.sound=true] - Si debe emitir sonido
   * @param {string} [options.soundName='Glass'] - Nombre del sonido en macOS
   * @returns {Promise<boolean>}
   */
  async sendSystemNotification({ title = 'Antigravity Meter', subtitle = '', message = '', sound = true, soundName = 'Glass' } = {}) {
    const platform = os.platform();

    if (platform === 'darwin') {
      return this._sendMacNotification({ title, subtitle, message, sound, soundName });
    } else if (platform === 'linux') {
      return this._sendLinuxNotification({ title, subtitle, message, sound });
    } else if (platform === 'win32') {
      return this._sendWindowsNotification({ title, subtitle, message, sound });
    }
    return false;
  }

  _escapeAppleScriptString(str) {
    return (str || '')
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"');
  }

  _sendMacNotification({ title, subtitle, message, sound, soundName }) {
    return new Promise((resolve) => {
      const cleanTitle = this._escapeAppleScriptString(title);
      const cleanSub = this._escapeAppleScriptString(subtitle);
      const cleanMsg = this._escapeAppleScriptString(message);
      const cleanSound = this._escapeAppleScriptString(soundName || 'Glass');

      let script = `display notification "${cleanMsg}" with title "${cleanTitle}"`;
      if (cleanSub) {
        script += ` subtitle "${cleanSub}"`;
      }
      if (sound) {
        script += ` sound name "${cleanSound}"`;
      }

      cp.execFile('osascript', ['-e', script], (error) => {
        if (error) {
          console.error('[Antigravity Meter] Error al enviar notificación macOS:', error);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  _sendLinuxNotification({ title, subtitle, message, sound }) {
    return new Promise((resolve) => {
      const body = subtitle ? `${subtitle}\n${message}` : message;
      cp.execFile('notify-send', ['-a', title, title, body], (error) => {
        if (error) {
          resolve(false);
        } else {
          if (sound) {
            // Intenta reproducir sonido estándar de freedesktop si existe
            cp.exec('paplay /usr/share/sounds/freedesktop/stereo/complete.oga 2>/dev/null || aplay /usr/share/sounds/freedesktop/stereo/complete.oga 2>/dev/null', () => { });
          }
          resolve(true);
        }
      });
    });
  }

  _sendWindowsNotification({ title, subtitle, message, sound }) {
    return new Promise((resolve) => {
      const body = subtitle ? `${subtitle} - ${message}` : message;
      const psCommand = `
        [reflection.assembly]::loadwithpartialname('System.Windows.Forms') | Out-Null;
        $notify = New-Object System.Windows.Forms.NotifyIcon;
        $notify.Icon = [System.Drawing.SystemIcons]::Information;
        $notify.BalloonTipTitle = '${title.replace(/'/g, "''")}';
        $notify.BalloonTipText = '${body.replace(/'/g, "''")}';
        $notify.Visible = $True;
        $notify.ShowBalloonTip(4000);
        ${sound ? '[System.Media.SystemSounds]::Asterisk.Play();' : ''}
      `;
      cp.execFile('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psCommand], (error) => {
        if (error) {
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  /**
   * Reproduce el sonido de alerta directamente sin necesidad de enviar una notificación.
   * En macOS utiliza /usr/bin/afplay para reproducir el archivo de sonido del sistema.
   *
   * @param {string} [soundName='Glass'] - Nombre del sonido (Glass, Ping, Hero, etc.)
   * @returns {Promise<boolean>}
   */
  playSound(soundName = 'Glass') {
    const platform = os.platform();
    return new Promise((resolve) => {
      if (platform === 'darwin') {
        const soundPath = `/System/Library/Sounds/${soundName}.aiff`;
        cp.execFile('/usr/bin/afplay', [soundPath], (err) => {
          if (err) {
            // Fallback al sonido por defecto si el archivo no existe
            cp.execFile('/usr/bin/afplay', ['/System/Library/Sounds/Glass.aiff'], () => resolve(false));
          } else {
            resolve(true);
          }
        });
      } else if (platform === 'linux') {
        cp.exec('paplay /usr/share/sounds/freedesktop/stereo/complete.oga 2>/dev/null || aplay /usr/share/sounds/freedesktop/stereo/complete.oga 2>/dev/null', (err) => {
          resolve(!err);
        });
      } else if (platform === 'win32') {
        cp.execFile('powershell', ['-NoProfile', '-Command', '[System.Media.SystemSounds]::Asterisk.Play();'], (err) => {
          resolve(!err);
        });
      } else {
        resolve(false);
      }
    });
  }
}

module.exports = { NotificationService };
