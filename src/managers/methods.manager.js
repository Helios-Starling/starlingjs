// src/managers/methods.manager.js

/**
 * @typedef MethodOptions
 * @property {number} [timeout=30000] - Method execution timeout
 */

export class MethodsManager {
    /**
     * @param {Starling} starling
     */
    constructor(starling) {
        this.starling = starling;
        /** @type {Map<string, Method>} */
        this.methods = new Map();

        // Namespaces réservés
        this.reservedNames = new Set(['system', 'internal', 'stream', 'helios']);
    }

    /**
     * @param {string} name
     * @param {Function} handler
     * @param {MethodOptions} options
     */
    add(name, handler, options = {}) {
        this.validateMethodName(name);

        const method = new Method(this.starling, name, handler, options);
        this.methods.set(name, method);

        this.starling.events.emit('method:added', {
            method: name,
            debug: {
                message: `Method "${name}" registered`,
                type: 'info'
            }
        });
    }

    /**
     * @param {string} name
     * @returns {Method|undefined}
     */
    get(name) {
        return this.methods.get(name);
    }

    /**
     * @param {string} name
     */
    validateMethodName(name) {
        if (!name || typeof name !== 'string') {
            throw new Error('Method name must be a non-empty string');
        }

        if (name.length < 3) {
            throw new Error('Method name must be at least 3 characters long');
        }

        if (!/^[a-zA-Z][\w:]*$/.test(name)) {
            throw new Error('Method name must start with a letter and contain only letters, numbers, underscores and colons');
        }

        if (this.methods.has(name)) {
            throw new Error(`Method "${name}" already exists`);
        }

        const namespace = name.split(':')[0];
        if (this.reservedNames.has(namespace)) {
            throw new Error(`Namespace "${namespace}" is reserved`);
        }
    }
}

class Method {
    /**
     * @param {Starling} starling
     * @param {string} name
     * @param {Function} handler
     * @param {MethodOptions} options
     */
    constructor(starling, name, handler, options = {}) {
        this.starling = starling;
        this.name = name;
        this.handler = handler;
        this.options = {
            timeout: 30000,
            ...options
        };
    }

    /**
     * @param {RequestContext} context
     */
    async execute(context) {
        try {
            await Promise.race([
                this.handler(context),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Method timeout')), this.options.timeout)
                )
            ]);
        } catch (error) {
            context.error('METHOD_ERROR', error.message);
        }
    }
}

/**
 * @class RequestContext
 */
export class RequestContext {
    /**
     * @param {Starling} starling
     * @param {*} payload
     * @param {Object} options
     */
    constructor(starling, payload, { requestId, timestamp, options = {} }) {
        this.starling = starling;
        this.payload = payload;
        this.requestId = requestId;
        this.timestamp = timestamp;
        this.options = options;
        this.finished = false;
    }

    success(data) {
        if (this.finished) {
            throw new Error('Request already finished');
        }
        this.finished = true;

        this.starling.standard('response', {
            requestId: this.requestId,
            success: true,
            data
        });
    }

    error(code, message) {
        if (this.finished) {
            throw new Error('Request already finished');
        }
        this.finished = true;

        this.starling.standard('response', {
            requestId: this.requestId,
            success: false,
            error: {
                code,
                message
            }
        });
    }

    notification(data) {
        if (this.finished) {
            throw new Error('Request already finished');
        }

        this.starling.standard('notification', {
            requestId: this.requestId,
            data
        });
    }
}