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
    constructor(starling: import("../core/starling").Starling, options?: StateManagerOptions);
    /** @private */
    private _starling;
    /** @private */
    private _options;
    /** @private */
    private _token;
    /** @private */
    private _lastRefresh;
    /** @private */
    private _refreshTimer;
    /** @private */
    private _refreshing;
    /** @private */
    private _metrics;
    /**
     * Refresh the state token
     * @param {Object} [options] Refresh options
     * @param {boolean} [options.force=false] Ignore minimum interval
     * @param {number} [options.timeout] Custom timeout
     * @returns {Promise<string>} Recovery token
     */
    refresh(options?: {
        force?: boolean;
        timeout?: number;
    }): Promise<string>;
    /**
     * Ensure a fresh token
     * @returns {Promise<string>} Recovery token
     */
    ensureFreshToken(): Promise<string>;
    /**
     * Get the current token
     * @returns {string|null} Recovery token or null
     */
    get token(): string | null;
    /**
     * Get connection metrics
     * @returns {Object} Metrics object
     */
    get metrics(): any;
    /**
     * Reset connection metrics
     */
    resetMetrics(): void;
    /**
     * Bind event listeners
     * @private
     */
    private _bindEvents;
    /**
     * Schedule the next refresh
     * @private
     */
    private _scheduleNextRefresh;
    /**
     * Calculate the current uptime
     * @returns {number} Uptime in milliseconds
     * @private
     */
    private _calculateUptime;
    /**
     * Emit an event of success for refresh
     * @private
     */
    private _emitRefreshSuccess;
    /**
     * Debug log
     * @param {string} message Debug message
     * @private
     */
    private _debug;
}
export type StateManagerOptions = {
    /**
     * Refresh interval (5min)
     */
    refreshInterval?: number;
    /**
     * Minimum interval between refreshes (1min)
     */
    minRefreshInterval?: number;
    /**
     * Number of retry attempts on failure
     */
    retryAttempts?: number;
    /**
     * Delay between retry attempts (ms)
     */
    retryDelay?: number;
    /**
     * Force a refresh after reconnect
     */
    forceRefreshOnReconnect?: boolean;
    /**
     * Enable debug logs
     */
    debug?: boolean;
};
