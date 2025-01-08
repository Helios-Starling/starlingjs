// reconnection-manager.js

/**
 * @typedef ReconnectionOptions
 * @property {number} [delay=1000] Délai initial entre les tentatives
 * @property {number} [maxAttempts=5] Nombre maximum de tentatives
 * @property {number} [backoffFactor=1.5] Facteur de croissance du délai
 */

export class ReconnectionManager {
    /**
     * @param {Starling} starling
     * @param {ReconnectionOptions} options
     */
    constructor(starling, options = {}) {
        this.starling = starling;
        this.options = {
            delay: 1000,
            maxAttempts: 5,
            backoffFactor: 1.5,
            ...options
        };

        this.attempts = 0;
        this.timeoutId = null;
        this.active = false;
    }

    /**
     * @returns {number}
     */
    get currentDelay() {
        return this.options.delay * Math.pow(this.options.backoffFactor, this.attempts);
    }

    /**
     * @returns {boolean}
     */
    get canRetry() {
        return this.attempts < this.options.maxAttempts;
    }

    start() {
        if (this.active) return;

        this.active = true;
        this.attempts = 0;
        this.scheduleReconnect();
    }

    stop() {
        this.active = false;
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
    }

    reset() {
        this.attempts = 0;
        this.stop();
    }

    async scheduleReconnect() {
        if (!this.active || !this.canRetry || this.starling.connected) return;

        const delay = this.currentDelay;

        this.starling.events.emit('reconnect:scheduled', {
            attempt: this.attempts + 1,
            delay,
            debug: {
                message: `Reconnection attempt ${this.attempts + 1}/${this.options.maxAttempts} scheduled in ${delay}ms`,
                type: 'info'
            }
        });

        await new Promise(resolve => {
            this.timeoutId = setTimeout(resolve, delay);
        });

        if (!this.active) return;

        try {
            this.attempts++;
            await this.starling.connect();

            // Si on arrive ici, la connexion a réussi
            this.reset();

        } catch (error) {
            if (this.canRetry) {
                this.scheduleReconnect();
            } else {
                this.starling.events.emit('reconnect:failed', {
                    attempts: this.attempts,
                    debug: {
                        message: 'Max reconnection attempts reached',
                        type: 'error'
                    }
                });
                this.reset();
            }
        }
    }
}