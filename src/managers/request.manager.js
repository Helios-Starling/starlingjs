// src/managers/requests.manager.js

/**
 * @typedef RequestOptions
 * @property {number} [timeout=30000] Request timeout in ms
 * @property {boolean} [retry=true] Should retry on connection loss
 */

export class RequestsManager {
    /**
     * @param {Starling} starling
     */
    constructor(starling) {
        this.starling = starling;
        /** @type {Map<string, Request>} */
        this.pending = new Map();
    }

    /**
     * @param {string} method
     * @param {*} payload
     * @param {RequestOptions} options
     * @returns {Request}
     */
    create(method, payload, options = {}) {
        const request = new Request(this.starling, method, payload, options);
        this.pending.set(request.id, request);
        return request;
    }

    /**
     * @param {string} id
     */
    get(id) {
        return this.pending.get(id);
    }

    /**
     * @param {Request} request
     */
    remove(request) {
        this.pending.delete(request.id);
    }

    /**
     * @param {Object} response
     */
    handleResponse(response) {
        const request = this.pending.get(response.requestId);
        if (request) {
            request.handleResponse(response);
            this.remove(request);
        }
    }

    /**
     * Cancel all pending requests
     * @param {string} reason
     */
    cancelAll(reason = 'Connection closed') {
        for (const request of this.pending.values()) {
            request.cancel(reason);
        }
        this.pending.clear();
    }
}

/**
 * Represents a single request
 */
class Request {
    /**
     * @param {Starling} starling
     * @param {string} method
     * @param {*} payload
     * @param {RequestOptions} options
     */
    constructor(starling, method, payload, options = {}) {
        this.starling = starling;
        this.id = crypto.randomUUID();
        this.method = method;
        this.payload = payload;
        this.options = {
            timeout: 30000,
            retry: true,
            ...options
        };

        this.timestamp = Date.now();
        this.timeoutId = null;
        /** @type {function} */
        this.resolve = null;
        /** @type {function} */
        this.reject = null;
    }

    /**
     * Execute the request
     * @returns {Promise<*>}
     */
    execute() {
        return new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;

            this.timeoutId = setTimeout(() => {
                this.handleTimeout();
            }, this.options.timeout);

            this.starling.standard('request', {
                requestId: this.id,
                method: this.method,
                payload: this.payload,
                options: this.options
            });
        });
    }

    /**
     * @param {Object} response
     */
    handleResponse(response) {
        clearTimeout(this.timeoutId);

        if (response.success) {
            this.resolve(response.data);
        } else {
            this.reject(response.error);
        }
    }

    handleTimeout() {
        this.reject({
            code: 'REQUEST_TIMEOUT',
            message: `Request to method ${this.method} timed out after ${this.options.timeout}ms`
        });
        this.starling.requests.remove(this);
    }

    /**
     * @param {string} reason
     */
    cancel(reason = 'Request cancelled') {
        clearTimeout(this.timeoutId);
        this.reject({
            code: 'REQUEST_CANCELLED',
            message: reason
        });
        this.starling.requests.remove(this);
    }
}