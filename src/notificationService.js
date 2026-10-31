const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const WINDOWS_SOUND_MAP = {
  Glass: 'notify.wav',
  Ping: 'ding.wav',
  Hero: 'tada.wav',
  Blow: 'chimes.wav',
  Bottle: 'chord.wav',
  Pop: 'recycle.wav',
  Purr: 'notify.wav',
  Sosumi: 'chord.wav',
  Submarine: 'ding.wav',
  Tink: 'ding.wav',
  Basso: 'chord.wav',
  Frog: 'chord.wav',
  Funk: 'chimes.wav',
  Morse: 'ding.wav'
};

class NotificationService {
  async sendSystemNotification({ title = 'Antigravity Meter', subtitle = '', message = '', sound = true, soundName = 'Glass' } = {}) {
    const platform = os.platform();

    if (platform === 'darwin') {
      return this._sendMacNotification({ title, subtitle, message, sound, soundName });
    } else if (platform === 'linux') {
      return this._sendLinuxNotification({ title, subtitle, message, sound });
    } else if (platform === 'win32') {
      return this._sendWindowsNotification({ title, subtitle, message, sound, soundName });
    }
    return false;
  }

  _escapeAppleScriptString(str) {
    return (str || '')
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"');
  }

  _escapeXml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
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
            cp.exec('paplay /usr/share/sounds/freedesktop/stereo/complete.oga 2>/dev/null || aplay /usr/share/sounds/freedesktop/stereo/complete.oga 2>/dev/null', () => { });
          }
          resolve(true);
        }
      });
    });
  }

  _sendWindowsNotification({ title, subtitle, message, sound, soundName }) {
    return new Promise((resolve) => {
      const cleanTitle = this._escapeXml(title);
      const cleanSub = subtitle ? this._escapeXml(subtitle) : '';
      const cleanMsg = message ? this._escapeXml(message) : '';

      const textNodes = [
        `<text>${cleanTitle}</text>`,
        cleanSub ? `<text>${cleanSub}</text>` : null,
        cleanMsg ? `<text>${cleanMsg}</text>` : null
      ].filter(Boolean).join('\n      ');

      const audioXml = sound
        ? '<audio src="ms-winsoundevent:Notification.Default" />'
        : '<audio silent="true" />';

      let imageXml = '';
      const iconPath = path.resolve(__dirname, '..', 'assets', 'icon.png');
      if (fs.existsSync(iconPath)) {
        const uri = 'file:///' + iconPath.replace(/\\/g, '/');
        imageXml = `<image placement="appLogoOverride" hint-crop="circle" src="${uri}" />`;
      }

      const balloonText = cleanSub ? `${cleanSub} - ${cleanMsg}` : cleanMsg;

      const psScript = `
$ErrorActionPreference = 'Stop'
try {
  [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
  [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null

  $xmlTemplate = @"
<toast>
  <visual>
    <binding template="ToastGeneric">
      ${imageXml}
      ${textNodes}
    </binding>
  </visual>
  ${audioXml}
</toast>
"@

  $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
  $xml.LoadXml($xmlTemplate)
  $toast = [Windows.UI.Notifications.ToastNotification]::new($xml)

  $appIds = @(
    'Google.AntigravityIDE',
    'Microsoft.VisualStudioCode',
    '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe'
  )

  $sent = $false
  foreach ($appId in $appIds) {
    try {
      $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($appId)
      $notifier.Show($toast)
      $sent = $true
      break
    } catch {
    }
  }

  if (-not $sent) {
    throw "No registered AppId could send the toast"
  }
} catch {
  try {
    [reflection.assembly]::loadwithpartialname('System.Windows.Forms') | Out-Null
    $notify = New-Object System.Windows.Forms.NotifyIcon
    $notify.Icon = [System.Drawing.SystemIcons]::Information
    $notify.BalloonTipTitle = '${cleanTitle.replace(/'/g, "''")}'
    $notify.BalloonTipText = '${balloonText.replace(/'/g, "''")}'
    $notify.Visible = $True
    $notify.ShowBalloonTip(4000)
    ${sound ? '[System.Media.SystemSounds]::Asterisk.Play();' : ''}
    Start-Sleep -Seconds 3
    $notify.Dispose()
  } catch {
    exit 1
  }
}
`;

      const child = cp.spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', '-'], {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      child.on('error', () => resolve(false));
      child.on('close', (code) => resolve(code === 0));

      child.stdin.write(psScript);
      child.stdin.end();
    });
  }

  playSound(soundName = 'Glass') {
    const platform = os.platform();
    return new Promise((resolve) => {
      if (platform === 'darwin') {
        const soundPath = `/System/Library/Sounds/${soundName}.aiff`;
        cp.execFile('/usr/bin/afplay', [soundPath], (err) => {
          if (err) {
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
        const wavName = WINDOWS_SOUND_MAP[soundName] || 'notify.wav';
        const winScript = `
          $mediaPath = Join-Path $env:SystemRoot "Media\\${wavName}"
          if (Test-Path $mediaPath) {
            (New-Object System.Media.SoundPlayer $mediaPath).PlaySync()
          } else {
            [System.Media.SystemSounds]::Asterisk.Play()
            Start-Sleep -Milliseconds 600
          }
        `;
        const child = cp.spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', '-'], {
          windowsHide: true,
          stdio: ['pipe', 'pipe', 'pipe']
        });
        child.on('error', () => resolve(false));
        child.on('close', (code) => resolve(code === 0));
        child.stdin.write(winScript);
        child.stdin.end();
      } else {
        resolve(false);
      }
    });
  }
}

module.exports = { NotificationService };
