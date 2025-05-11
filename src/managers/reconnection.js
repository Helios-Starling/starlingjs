import { getCurrentTimestamp, TimeConstants } from '@helios-starling/utils';

/**
 * @typedef {Object} ReconnectionOptions
 * @property {number} [minDelay=100] Minimum delay between attempts (ms)
 * @property {number} [maxDelay=30000] Maximum delay between attempts (ms)
 * @property {number} [maxAttempts=Infinity] Maximum number of attempts
 * @property {number} [backoffMultiplier=1.5] Exponential backoff multiplier
 * @property {number} [resetThreshold=60000] Time before resetting attempt counter (ms)
 * @property {boolean} [debug=false] Enable debug logs
 */

/**
 * @typedef {Object} ReconnectionMetrics
 * @property {number} attempts Current attempt count since last reset
 * @property {number} totalAttempts Total attempts made
 * @property {number} successfulReconnections Successful reconnection count
 * @property {number} failedAttempts Failed attempt count
 * @property {number} lastAttempt Last attempt timestamp
 * @property {number} lastSuccess Last successful reconnection timestamp
 * @property {number} lastReset Last reset timestamp
 * @property {number} averageAttemptDuration Average duration of attempts (ms)
 * @property {number} currentDelay Current delay between attempts (ms)
 */

/**
 * Manages automatic reconnection with exponential backoff
 */
export class ReconnectionManager {
  /**
   * @param {import('../core/starling').Starling} starling
   * @param {ReconnectionOptions} [options]
   */
  constructor(starling, options = {}) {
    /** @private */
    this._starling = starling;
    
    /** @private */
    this._options = this._initializeOptions(options);
    
    /** @private */
    this._state = {
      active: false,
      currentAttempt: null,
      timeoutId: null
    };

    /** @private */
    this._metrics = this._initializeMetrics();

    this._bindConnectionEvents();
  }

  /**
   * Starts the reconnection process if not already active
   * @returns {Promise<void>}
   */
  async start() {
    if (this._state.active) return;
    
    this._state.active = true;
    this._starling.events.emit('starling:reconnect:started', {
      metrics: this.getMetrics(),
      debug: {
        type: 'info',
        message: 'Reconnection process started'
      }
    });
    this._starling.events.emit('starling:state', {
      reconnecting: true,
    });

    this._checkResetThreshold();
    await this._executeNextAttempt();
  }

  /**
   * Stops the current reconnection process
   */
  stop() {
    this._state.active = false;
    this._clearPendingAttempts();
    this._log('Reconnection process stopped');
    this._starling.events.emit('starling:reconnect:stopped', {
      metrics: this.getMetrics(),
      debug: {
        type: 'info',
        message: 'Reconnection process stopped'
      }
    });

    this._starling.events.emit('starling:state', {
      reconnecting: false,
    });
  }

  /**
   * Forces an immediate reconnection attempt
   */
  async forceAttempt() {
    this.stop();
    this._state.active = true;
    return this._executeReconnection();
  }

  /**
   * Resets all metrics and state
   */
  reset() {
    this.stop();
    this._metrics = this._initializeMetrics();
    this._log('Manager reset');
  }

  /**
   * @returns {ReconnectionMetrics}
   */
  getMetrics() {
    return {
      ...this._metrics,
      averageAttemptDuration: this._calculateAverageAttemptDuration()
    };
  }

  /**
   * Initializes manager options with defaults
   * @private
   * @param {ReconnectionOptions} userOptions
   * @returns {ReconnectionOptions}
   */
  _initializeOptions(userOptions) {
    return {
      minDelay: TimeConstants.RECONNECT_MIN_DELAY,
      maxDelay: TimeConstants.RECONNECT_MAX_DELAY,
      maxAttempts: Infinity,
      backoffMultiplier: 1.5,
      resetThreshold: 60000,
      debug: false,
      ...userOptions
    };
  }

  /**
   * Initializes metrics with default values
   * @private
   * @returns {Object}
   */
  _initializeMetrics() {
    return {
      attempts: 0,
      totalAttempts: 0,
      successfulReconnections: 0,
      failedAttempts: 0,
      lastAttempt: null,
      lastSuccess: null,
      lastReset: getCurrentTimestamp(),
      attemptDurations: [],
      currentDelay: this._options.minDelay
    };
  }

  /**
   * Executes the next reconnection attempt
   * @private
   */
  async _executeNextAttempt() {
    if (!this._state.active || this._hasReachedMaxAttempts()) {
      this._hasReachedMaxAttempts() && this._emitMaxAttemptsReached();
      this.stop();
      return;
    }

    const delay = this._calculateNextDelay();
    this._metrics.currentDelay = delay;
    
    this._emitScheduled();
    await this._wait(delay);
    
    if (this._state.active) {
      await this._executeReconnection();
    }
  }

  /**
   * Executes a single reconnection attempt
   * @private
   */
  async _executeReconnection() {
    if (!this._state.active) return;

    this._updateMetricsForNewAttempt();
    this._emitAttemptStarted();

    try {
      this._state.currentAttempt = new AbortController();
      await this._attemptConnection();
    } catch (error) {
      if (error.message === 'Reconnection attempt aborted') {
        this._log('Attempt aborted');
        return;
      }
      
      this._handleFailedAttempt(error);
      await this._executeNextAttempt();
    } finally {
      this._state.currentAttempt = null;
    }
  }

  /**
   * Attempts to establish a connection with abort capability
   * @private
   */
  async _attemptConnection() {
    return Promise.race([
      this._starling.connect(),
      new Promise((_, reject) => {
        this._state.currentAttempt.signal.addEventListener('abort', () => {
          reject(new Error('Reconnection attempt aborted'));
        });
      })
    ]);
  }

  /**
   * Binds event handlers for connection states
   * @private
   */
  _bindConnectionEvents() {
    this._starling.events.on('starling:connected', () => {
      this._handleSuccessfulConnection();
    });
  }

  /**
   * Handles a successful connection
   * @private
   */
  _handleSuccessfulConnection() {
    const duration = getCurrentTimestamp() - this._metrics.lastAttempt;
    this._updateMetricsForSuccess(duration);
    this.stop();
  }

  /**
   * Updates metrics for a successful connection
   * @private
   * @param {number} duration
   */
  _updateMetricsForSuccess(duration) {
    this._updateAttemptDurations(duration);
    this._metrics.successfulReconnections++;
    this._metrics.lastSuccess = getCurrentTimestamp();
  }

  /**
   * Updates metrics for a new attempt
   * @private
   */
  _updateMetricsForNewAttempt() {
    this._metrics.attempts++;
    this._metrics.totalAttempts++;
    this._metrics.lastAttempt = getCurrentTimestamp();
  }

  /**
   * Handles a failed connection attempt
   * @private
   * @param {Error} error
   */
  _handleFailedAttempt(error) {
    this._metrics.failedAttempts++;
    this._emitAttemptFailed(error);
  }

  /**
   * Checks if maximum attempts have been reached
   * @private
   * @returns {boolean}
   */
  _hasReachedMaxAttempts() {
    return this._metrics.attempts >= this._options.maxAttempts;
  }

  /**
   * Calculates the next delay using exponential backoff
   * @private
   * @returns {number}
   */
  _calculateNextDelay() {
    return Math.min(
      this._metrics.currentDelay * this._options.backoffMultiplier,
      this._options.maxDelay
    );
  }

  /**
   * Updates the stored attempt durations
   * @private
   * @param {number} duration
   */
  _updateAttemptDurations(duration) {
    this._metrics.attemptDurations.push(duration);
    if (this._metrics.attemptDurations.length > 10) {
      this._metrics.attemptDurations.shift();
    }
  }

  /**
   * Calculates the average attempt duration
   * @private
   * @returns {number}
   */
  _calculateAverageAttemptDuration() {
    const durations = this._metrics.attemptDurations;
    return durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;
  }

  /**
   * Checks if attempt counter should be reset
   * @private
   */
  _checkResetThreshold() {
    const now = getCurrentTimestamp();
    if (now - this._metrics.lastReset >= this._options.resetThreshold) {
      this._metrics.attempts = 0;
      this._metrics.currentDelay = this._options.minDelay;
      this._metrics.lastReset = now;
      this._log('Attempt counter reset due to threshold');
    }
  }

  /**
   * Clears any pending reconnection attempts
   * @private
   */
  _clearPendingAttempts() {
    if (this._state.timeoutId) {
      clearTimeout(this._state.timeoutId);
      this._state.timeoutId = null;
    }
    
    if (this._state.currentAttempt) {
      this._state.currentAttempt.abort();
      this._state.currentAttempt = null;
    }
  }

  /**
   * Creates a delay promise
   * @private
   * @param {number} ms
   * @returns {Promise<void>}
   */
  async _wait(ms) {
    return new Promise(resolve => {
      this._state.timeoutId = setTimeout(resolve, ms);
    });
  }

  /**
   * Emits a scheduled attempt event
   * @private
   */
  _emitScheduled() {
    this._starling.events.emit('starling:reconnect:scheduled', {
      metrics: this.getMetrics(),
      debug: {
        type: 'info',
        message: `Reconnection attempt ${this._metrics.attempts + 1} scheduled in ${this._metrics.currentDelay}ms`
      }
    });
  }

  /**
   * Emits an attempt started event
   * @private
   */
  _emitAttemptStarted() {
    console.log(`🚀 Reconnection attempt ${this._metrics.attempts}/${this._options.maxAttempts} started`);
    
    this._starling.events.emit('starling:reconnect:attempt', {
      attempt: this._metrics.attempts,
      metrics: this.getMetrics(),
      debug: {
        type: 'info',
        message: `Starting reconnection attempt ${this._metrics.attempts}`
      }
    });
  }

  /**
   * Emits an attempt failed event
   * @private
   * @param {Error} error
   */
  _emitAttemptFailed(error) {
    this._starling.events.emit('starling:reconnect:failed', {
      attempt: this._metrics.attempts,
      error,
      metrics: this.getMetrics(),
      debug: {
        type: 'error',
        message: `Reconnection attempt ${this._metrics.attempts} failed: ${error.message}`
      }
    });
  }

  /**
   * Emits a max attempts reached event
   * @private
   */
  _emitMaxAttemptsReached() {
    this._starling.events.emit('starling:reconnect:max_attempts', {
      metrics: this.getMetrics(),
      debug: {
        type: 'warning',
        message: `Maximum reconnection attempts (${this._options.maxAttempts}) reached`
      }
    });
  }

  /**
   * Logs a debug message if debug is enabled
   * @private
   * @param {string} message
   */
  _log(message) {
    if (this._options.debug) {
      this._starling.events.emit('starling:reconnect:debug', {
        message,
        timestamp: getCurrentTimestamp(),
        debug: {
          type: 'debug',
          message: `[ReconnectionManager] ${message}`
        }
      });
    }
  }


  get state() {
    return this._state;
  }

  get active() {
    return this._state.active;
  }
}