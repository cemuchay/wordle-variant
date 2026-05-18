import { supabase } from './supabaseClient';

export type LogLevel = 'info' | 'warn' | 'error' | 'fatal';

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: any;
  timestamp: string;
}

class Logger {
  private static instance: Logger;
  private sessionId: string;
  private buffer: LogEntry[] = [];
  private readonly MAX_BUFFER_SIZE = 50;
  private isStreaming = false;

  private constructor() {
    this.sessionId = Math.random().toString(36).substring(2, 15);
    this.initGlobalHandlers();
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private initGlobalHandlers() {
    window.onerror = (message, source, lineno, colno, error) => {
      this.fatal('Unhandled Runtime Error', {
        message,
        source,
        lineno,
        colno,
        stack: error?.stack,
      });
    };

    window.onunhandledrejection = (event) => {
      this.error('Unhandled Promise Rejection', {
        reason: event.reason,
      });
    };
  }

  private async getUserId(): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  }

  private addToBuffer(entry: LogEntry) {
    this.buffer.push(entry);
    if (this.buffer.length > this.MAX_BUFFER_SIZE) {
      this.buffer.shift();
    }
  }

  private async streamLog(entry: LogEntry) {
    if (this.isStreaming) return;
    this.isStreaming = true;

    try {
      const userId = await this.getUserId();
      const { error } = await supabase.from('client_logs').insert([{
        level: entry.level,
        message: entry.message,
        context: {
          ...entry.context,
          browser: navigator.userAgent,
          url: window.location.href,
          timestamp: entry.timestamp,
        },
        session_id: this.sessionId,
        user_id: userId,
      }]);

      if (error) {
        console.warn('[Logger] Failed to stream log to Supabase:', error.message);
      }
    } catch (e) {
      console.warn('[Logger] Error in streamLog:', e);
    } finally {
      this.isStreaming = false;
    }
  }

  public info(message: string, context?: any) {
    const entry: LogEntry = { level: 'info', message, context, timestamp: new Date().toISOString() };
    this.addToBuffer(entry);
    console.log(`[INFO] ${message}`, context);
  }

  public warn(message: string, context?: any) {
    const entry: LogEntry = { level: 'warn', message, context, timestamp: new Date().toISOString() };
    this.addToBuffer(entry);
    console.warn(`[WARN] ${message}`, context);
  }

  public error(message: string, context?: any) {
    const entry: LogEntry = { level: 'error', message, context, timestamp: new Date().toISOString() };
    this.addToBuffer(entry);
    console.error(`[ERROR] ${message}`, context);
    this.streamLog(entry);
  }

  public fatal(message: string, context?: any) {
    const entry: LogEntry = { level: 'fatal', message, context, timestamp: new Date().toISOString() };
    this.addToBuffer(entry);
    console.error(`[FATAL] ${message}`, context);
    // Fatal logs are always streamed immediately
    this.streamLog(entry);
  }

  public getLogs(): LogEntry[] {
    return [...this.buffer];
  }

  public downloadLogs() {
    const data = JSON.stringify({
      sessionId: this.sessionId,
      logs: this.buffer,
      device: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        screen: `${window.screen.width}x${window.screen.height}`,
      }
    }, null, 2);

    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `wordle-debug-logs-${new Date().toISOString()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export const logger = Logger.getInstance();
