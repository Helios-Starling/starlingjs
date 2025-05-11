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
    constructor(starling: import("../core/starling").Starling, options?: ReconnectionOptions);
    /** @private */
    private _starling;
    /** @private */
    private _options;
    /** @private */
    private _state;
    /** @private */
    private _metrics;
    /**
     * Starts the reconnection process if not already active
     * @returns {Promise<void>}
     */
    start(): Promise<void>;
    /**
     * Stops the current reconnection process
     */
    stop(): void;
    /**
     * Forces an immediate reconnection attempt
     */
    forceAttempt(): Promise<void>;
    /**
     * Resets all metrics and state
     */
    reset(): void;
    /**
     * @returns {ReconnectionMetrics}
     */
    getMetrics(): ReconnectionMetrics;
    /**
     * Initializes manager options with defaults
     * @private
     * @param {ReconnectionOptions} userOptions
     * @returns {ReconnectionOptions}
     */
    private _initializeOptions;
    /**
     * Initializes metrics with default values
     * @private
     * @returns {Object}
     */
    private _initializeMetrics;
    /**
     * Executes the next reconnection attempt
     * @private
     */
    private _executeNextAttempt;
    /**
     * Executes a single reconnection attempt
     * @private
     */
    private _executeReconnection;
    /**
     * Attempts to establish a connection with abort capability
     * @private
     */
    private _attemptConnection;
    /**
     * Binds event handlers for connection states
     * @private
     */
    private _bindConnectionEvents;
    /**
     * Handles a successful connection
     * @private
     */
    private _handleSuccessfulConnection;
    /**
     * Updates metrics for a successful connection
     * @private
     * @param {number} duration
     */
    private _updateMetricsForSuccess;
    /**
     * Updates metrics for a new attempt
     * @private
     */
    private _updateMetricsForNewAttempt;
    /**
     * Handles a failed connection attempt
     * @private
     * @param {Error} error
     */
    private _handleFailedAttempt;
    /**
     * Checks if maximum attempts have been reached
     * @private
     * @returns {boolean}
     */
    private _hasReachedMaxAttempts;
    /**
     * Calculates the next delay using exponential backoff
     * @private
     * @returns {number}
     */
    private _calculateNextDelay;
    /**
     * Updates the stored attempt durations
     * @private
     * @param {number} duration
     */
    private _updateAttemptDurations;
    /**
     * Calculates the average attempt duration
     * @private
     * @returns {number}
     */
    private _calculateAverageAttemptDuration;
    /**
     * Checks if attempt counter should be reset
     * @private
     */
    private _checkResetThreshold;
    /**
     * Clears any pending reconnection attempts
     * @private
     */
    private _clearPendingAttempts;
    /**
     * Creates a delay promise
     * @private
     * @param {number} ms
     * @returns {Promise<void>}
     */
    private _wait;
    /**
     * Emits a scheduled attempt event
     * @private
     */
    private _emitScheduled;
    /**
     * Emits an attempt started event
     * @private
     */
    private _emitAttemptStarted;
    /**
     * Emits an attempt failed event
     * @private
     * @param {Error} error
     */
    private _emitAttemptFailed;
    /**
     * Emits a max attempts reached event
     * @private
     */
    private _emitMaxAttemptsReached;
    /**
     * Logs a debug message if debug is enabled
     * @private
     * @param {string} message
     */
    private _log;
    get state(): {
        active: boolean;
        currentAttempt: any;
        timeoutId: any;
    };
    get active(): boolean;
}
export type ReconnectionOptions = {
    /**
     * Minimum delay between attempts (ms)
     */
    minDelay?: number;
    /**
     * Maximum delay between attempts (ms)
     */
    maxDelay?: number;
    /**
     * Maximum number of attempts
     */
    maxAttempts?: number;
    /**
     * Exponential backoff multiplier
     */
    backoffMultiplier?: number;
    /**
     * Time before resetting attempt counter (ms)
     */
    resetThreshold?: number;
    /**
     * Enable debug logs
     */
    debug?: boolean;
};
export type ReconnectionMetrics = {
    /**
     * Current attempt count since last reset
     */
    attempts: number;
    /**
     * Total attempts made
     */
    totalAttempts: number;
    /**
     * Successful reconnection count
     */
    successfulReconnections: number;
    /**
     * Failed attempt count
     */
    failedAttempts: number;
    /**
     * Last attempt timestamp
     */
    lastAttempt: number;
    /**
     * Last successful reconnection timestamp
     */
    lastSuccess: number;
    /**
     * Last reset timestamp
     */
    lastReset: number;
    /**
     * Average duration of attempts (ms)
     */
    averageAttemptDuration: number;
    /**
     * Current delay between attempts (ms)
     */
    currentDelay: number;
};
