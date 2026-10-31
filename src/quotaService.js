const http = require('http');
const cp = require('child_process');
const os = require('os');

class QuotaService {
  constructor() {
    this.cachedServer = null; // { port, csrfToken }
  }

  /**
   * Obtiene el resumen de cuota estructurado por grupos de modelos (Gemini, Claude/GPT),
   * incluyendo ventana de corto plazo (5h) y límite semanal (weekly).
   */
  async getQuotaSummary() {
    const server = await this._ensureConnection();
    if (!server) {
      return null;
    }

    try {
      const quotaData = await this._requestQuotaSummary(server.port, server.csrfToken);
      if (quotaData && quotaData.groups) {
        return this._normalizeQuotaGroups(quotaData.groups);
      }
    } catch (err) {
      // Si la conexión falló, invalidamos la caché para que el próximo intento vuelva a buscar el proceso
      this.cachedServer = null;
    }

    return null;
  }

  /**
   * Garantiza que tenemos un puerto y token válidos.
   */
  async _ensureConnection() {
    if (this.cachedServer) {
      return this.cachedServer;
    }
    const discovered = await this._discoverServer();
    if (discovered) {
      this.cachedServer = discovered;
      return discovered;
    }
    return null;
  }

  /**
   * Descubre el proceso de agy / language_server y sus puertos.
   */
  async _discoverServer() {
    const processes = this._findCandidateProcesses();
    for (const proc of processes) {
      // 1. Probar puerto directo (--hub-port o --extension_server_port) si vino en los argumentos
      if (proc.directPort) {
        const ok = await this._probeServer(proc.directPort, proc.csrfToken);
        if (ok) {
          return { port: proc.directPort, csrfToken: proc.csrfToken };
        }
      }

      // 2. Si no vino o no responde, buscar puertos escuchando con lsof o netstat
      const openPorts = this._findListeningPorts(proc.pid);
      for (const port of openPorts) {
        if (port === proc.directPort) continue;
        const ok = await this._probeServer(port, proc.csrfToken);
        if (ok) {
          return { port, csrfToken: proc.csrfToken };
        }
      }
    }
    return null;
  }

  _findCandidateProcesses() {
    const platform = os.platform();
    const candidates = [];

    try {
      let stdout = '';
      if (platform === 'win32') {
        stdout = cp.execSync(
          'powershell -ExecutionPolicy Bypass -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match \'csrf_token\' } | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress"',
          { timeout: 5000 }
        ).toString();

        if (stdout.trim()) {
          const list = stdout.startsWith('[') ? JSON.parse(stdout) : [JSON.parse(stdout)];
          for (const item of list) {
            const cmd = item.CommandLine || '';
            const csrfMatch = cmd.match(/--csrf_token[=\s]+(["']?)([a-zA-Z0-9\-_.]+)\1/);
            if (!csrfMatch) continue;
            const portMatch = cmd.match(/--(?:hub-port|extension_server_port)[=\s]+(\d+)/);
            candidates.push({
              pid: item.ProcessId,
              csrfToken: csrfMatch[2],
              directPort: portMatch ? parseInt(portMatch[1], 10) : null
            });
          }
        }
      } else {
        stdout = cp.execSync(
          'ps -A -ww -o pid,ppid,args | grep csrf_token | grep -v grep',
          { timeout: 5000 }
        ).toString();

        for (const line of stdout.trim().split('\n')) {
          const match = line.match(/^\s*(\d+)\s+(\d+)\s+(.*)$/);
          if (!match) continue;
          const [, pidStr, , cmd] = match;
          const csrfMatch = cmd.match(/--csrf_token[=\s]+(["']?)([a-zA-Z0-9\-_.]+)\1/);
          if (!csrfMatch) continue;
          const portMatch = cmd.match(/--(?:hub-port|extension_server_port)[=\s]+(\d+)/);
          candidates.push({
            pid: parseInt(pidStr, 10),
            csrfToken: csrfMatch[2],
            directPort: portMatch ? parseInt(portMatch[1], 10) : null
          });
        }
      }
    } catch {
      // Ignorar errores en escaneo de procesos
    }

    return candidates;
  }

  _findListeningPorts(pid) {
    const platform = os.platform();
    const ports = [];

    try {
      if (platform === 'darwin' || platform === 'linux') {
        const stdout = cp.execSync(
          `lsof -nP -a -iTCP -sTCP:LISTEN -p ${pid} 2>/dev/null`,
          { timeout: 3000 }
        ).toString();
        const matches = [...stdout.matchAll(/:(\d+)\s+\(LISTEN\)/g)];
        for (const m of matches) {
          const p = parseInt(m[1], 10);
          if (p > 0 && p <= 65535 && !ports.includes(p)) {
            ports.push(p);
          }
        }
      } else if (platform === 'win32') {
        const stdout = cp.execSync(
          `netstat -ano | findstr "LISTENING" | findstr " ${pid}$"`,
          { timeout: 3000 }
        ).toString();
        const matches = [...stdout.matchAll(/:(\d+)\s+.*LISTENING/g)];
        for (const m of matches) {
          const p = parseInt(m[1], 10);
          if (p > 0 && p <= 65535 && !ports.includes(p)) {
            ports.push(p);
          }
        }
      }
    } catch {
      // Ignorar errores de lsof/netstat
    }

    return ports;
  }

  _probeServer(port, csrfToken) {
    return new Promise((resolve) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path: '/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Codeium-Csrf-Token': csrfToken,
          'Connect-Protocol-Version': '1'
        },
        timeout: 1500
      }, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const json = JSON.parse(data);
              if (json?.response?.groups) {
                return resolve(true);
              }
            } catch {}
          }
          resolve(false);
        });
      });

      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
      req.write(JSON.stringify({ metadata: { ideName: 'antigravity' } }));
      req.end();
    });
  }

  _requestQuotaSummary(port, csrfToken) {
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path: '/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Codeium-Csrf-Token': csrfToken,
          'Connect-Protocol-Version': '1'
        },
        timeout: 3000
      }, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const json = JSON.parse(data);
              resolve(json.response);
            } catch (err) {
              reject(err);
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Timeout'));
      });
      req.write(JSON.stringify({ metadata: { ideName: 'antigravity' } }));
      req.end();
    });
  }

  /**
   * Normaliza los grupos devueltos por la API para uso fácil en el UI y alertas.
   */
  _normalizeQuotaGroups(rawGroups) {
    return rawGroups.map((group) => {
      const displayName = group.displayName || 'Modelos';
      let id = 'other';
      let shortName = displayName.split(' ')[0];

      if (/gemini/i.test(displayName)) {
        id = 'gemini';
        shortName = 'Gemini';
      } else if (/claude/i.test(displayName)) {
        id = 'claude';
        shortName = 'Claude';
      }

      const buckets = group.buckets || [];
      const bucket5h = buckets.find(b => b.window === '5h' || /hour|5h/i.test(b.bucketId || ''));
      const bucketWeekly = buckets.find(b => b.window === 'weekly' || /weekly/i.test(b.bucketId || ''));

      const parseBucket = (b) => {
        if (!b) return null;
        const fraction = typeof b.remainingFraction === 'number' ? b.remainingFraction : 1.0;
        const remainingPct = Math.max(0, Math.min(100, Math.round(fraction * 100)));
        const resetTime = b.resetTime || null;
        const countdown = this.formatCountdown(resetTime);
        return {
          bucketId: b.bucketId,
          displayName: b.displayName || '',
          description: b.description || '',
          window: b.window,
          remainingPct,
          resetTime,
          countdown
        };
      };

      const parsed5h = parseBucket(bucket5h);
      const parsedWeekly = parseBucket(bucketWeekly);

      // El porcentaje efectivo es el menor de los límites disponibles
      const percentages = [];
      if (parsed5h) percentages.push(parsed5h.remainingPct);
      if (parsedWeekly) percentages.push(parsedWeekly.remainingPct);
      const effectivePct = percentages.length > 0 ? Math.min(...percentages) : 100;

      return {
        id,
        displayName,
        shortName,
        limit5h: parsed5h,
        limitWeekly: parsedWeekly,
        effectivePct
      };
    });
  }

  /**
   * Formatea un tiempo restante relativo (ej: "3h 48m", "6d 1h").
   */
  formatCountdown(isoDateString) {
    if (!isoDateString) return 'Listo';
    const target = new Date(isoDateString).getTime();
    if (isNaN(target)) return 'N/A';

    const diff = target - Date.now();
    if (diff <= 0) return 'Listo';

    const totalMinutes = Math.floor(diff / (1000 * 60));
    const totalHours = Math.floor(totalMinutes / 60);
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    const minutes = totalMinutes % 60;

    if (days > 0) {
      return `${days}d ${hours}h`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }
}

module.exports = { QuotaService };

