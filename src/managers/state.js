// managers/state.js

import { getCurrentTimestamp } from '@helios-starling/utils';

/**
 * @typedef {Object} StateManagerOptions
 * @property {number} [refreshInterval=300000] Refresh interval (5min)
 * @property {number} [minRefreshInterval=60000] Minimum interval between refreshes (1min)
 * @property {number} [retryAttempts=3] Number of retry attempts on failure
 * @property {number} [retryDelay=1000] Delay between retry attempts (ms)
 * @property {boolean} [forceRefreshOnReconnect=true] Force a refresh after reconnect
 * @property {boolean} [debug=false] Enable debug logs
 */

/**
 * Manages connection state and synchronization with the server
 */
export class StateManager {
  /**
   * @param {import('../core/starling').Starling} starling Starling instance
   * @param {StateManagerOptions} [options] Configuration options
   */
  constructor(starling, options = {}) {
    /** @private */
    this._starling = starling;

    /** @private */
    this._options = {
      refreshInterval: 5 * 60 * 1000,    // 5 minutes
      minRefreshInterval: 60 * 1000,     // 1 minute
      retryAttempts: 3,
      retryDelay: 1000,
      forceRefreshOnReconnect: true,
      debug: false,
      ...options
    };

    /** @private */
    this._token = null;

    /** @private */
    this._lastRefresh = null;

    /** @private */
    this._refreshTimer = null;

    /** @private */
    this._refreshing = false;

    /** @private */
    this._metrics = {
      connectionAttempts: 0,
      reconnections: 0,
      lastDisconnect: null,
      totalDowntime: 0,
      refreshes: 0,
      refreshFailures: 0
    };

    // Bind event handlers
    this._bindEvents();
  }

  /**
   * Refresh the state token
   * @param {Object} [options] Refresh options
   * @param {boolean} [options.force=false] Ignore minimum interval
   * @param {number} [options.timeout] Custom timeout
   * @returns {Promise<string>} Recovery token
   */
  async refresh(options = {}) {
    if (this._refreshing) {
      throw new Error('Refresh already in progress');
    }

    const now = getCurrentTimestamp();
    
    // Vérifier l'intervalle minimum sauf si forcé
    if (!options.force && this._lastRefresh) {
      const elapsed = now - this._lastRefresh;
      if (elapsed < this._options.minRefreshInterval) {
        throw new Error(`Minimum refresh interval not reached (${Math.floor((this._options.minRefreshInterval - elapsed) / 1000)}s remaining)`);
      }
    }

    this._refreshing = true;
    let attempts = 0;

    try {
      while (attempts < this._options.retryAttempts) {
        try {
          const response = await this._starling.request('starling:state', null, {
            timeout: options.timeout
          });

          this._token = response.token;
          this._lastRefresh = now;
          this._metrics.refreshes++;

          this._debug('Token refreshed successfully');
          this._scheduleNextRefresh();

          // Émettre l'événement de succès
          this._emitRefreshSuccess();

          return this._token;

        } catch (error) {
          attempts++;
          
          this._metrics.refreshFailures++;
          this._debug(`Refresh attempt ${attempts} failed: ${error.message}`);

          if (attempts >= this._options.retryAttempts) {
            throw error;
          }

          // Attendre avant de réessayer
          await new Promise(resolve => setTimeout(resolve, this._options.retryDelay));
        }
      }
    } finally {
      this._refreshing = false;
    }
  }

  /**
   * Ensure a fresh token
   * @returns {Promise<string>} Recovery token
   */
  async ensureFreshToken() {
    const now = getCurrentTimestamp();
    
    // If no token or last refresh time, refresh immediately
    if (!this._token || !this._lastRefresh) {
      return this.refresh({ force: true });
    }

    // If refresh interval has passed, refresh immediately
    if (now - this._lastRefresh >= this._options.refreshInterval) {
      return this.refresh();
    }

    return this._token;
  }

  /**
   * Get the current token
   * @returns {string|null} Recovery token or null
   */
  get token() {
    return this._token;
  }

  /**
   * Get connection metrics
   * @returns {Object} Metrics object
   */
  get metrics() {
    return {
      ...this._metrics,
      lastRefresh: this._lastRefresh,
      refreshing: this._refreshing,
      connected: this._starling.connected,
      uptime: this._calculateUptime()
    };
  }

  /**
   * Reset connection metrics
   */
  resetMetrics() {
    this._metrics = {
      connectionAttempts: 0,
      reconnections: 0,
      lastDisconnect: null,
      totalDowntime: 0,
      refreshes: 0,
      refreshFailures: 0
    };
  }

  /**
   * Bind event listeners
   * @private
   */
  _bindEvents() {
    // Handle reconnections
    
    this._starling.events.on('starling:connected', () => {
      if (this._metrics.lastDisconnect) {
        this._metrics.reconnections++;
        this._metrics.totalDowntime += getCurrentTimestamp() - this._metrics.lastDisconnect;
        
        // Start the refresh timer
        if (this._options.forceRefreshOnReconnect) {
          this.refresh({ force: true }).catch(error => {
            this._debug(`Force refresh after reconnect failed: ${error.message}`);
          });
        }
      }
    });

    this._starling.events.on('starling:disconnected', () => {
      this._metrics.lastDisconnect = getCurrentTimestamp();
      // Stop the refresh timer
      if (this._refreshTimer) {
        clearTimeout(this._refreshTimer);
        this._refreshTimer = null;
      }
    });
  }

  /**
   * Schedule the next refresh
   * @private
   */
  _scheduleNextRefresh() {
    if (this._refreshTimer) {
      clearTimeout(this._refreshTimer);
    }

    this._refreshTimer = setTimeout(() => {
      this.refresh().catch(error => {
        this._debug(`Scheduled refresh failed: ${error.message}`);
      });
    }, this._options.refreshInterval);
  }

  /**
   * Calculate the current uptime
   * @returns {number} Uptime in milliseconds
   * @private
   */
  _calculateUptime() {
    const totalTime = getCurrentTimestamp() - this._starling.createdAt;
    return totalTime - this._metrics.totalDowntime;
  }

  /**
   * Emit an event of success for refresh
   * @private
   */
  _emitRefreshSuccess() {
    this._starling.events.emit('state:refreshed', {
      token: this._token,
      metrics: this.getMetrics(),
      debug: {
        type: 'info',
        message: 'State token refreshed successfully'
      }
    });
  }

  /**
   * Debug log
   * @param {string} message Debug message
   * @private
   */
  _debug(message) {
    if (this._options.debug) {
      this._starling.events.emit('state:debug', {
        message,
        timestamp: getCurrentTimestamp(),
        debug: {
          type: 'debug',
          message: `[StateManager] ${message}`
        }
      });
    }
  }
}