import {Pulse} from "@killiandvcz/pulse";
import {MessageBuffer} from "../managers/buffer.manager.js";
import {ReconnectionManager} from "../managers/reconnection.manager.js";
import {StandardMessageSchema, createStandardMessage} from "../schemas/messages.schema.js";
import {RequestsManager} from "../managers/request.manager.js";
import {MethodsManager, RequestContext} from "../managers/methods.manager.js";

/**
 * @typedef StarlingOptions
 * @property {number} [reconnectDelay=1000] Delay before reconnection attempt
 * @property {number} [maxReconnectAttempts=5] Maximum number of reconnection attempts
 */

/**
 * Core WebSocket client for Helios protocol
 */
export class Starling {
    /**
     * @param {string} url WebSocket server URL
     * @param {StarlingOptions} options Client options
     */
    constructor(url, options = {}) {
        /** @type {URL} */
        this.url = url instanceof URL ? url : new URL(url);
        this.options = {
            reconnectDelay: 1000,
            maxReconnectAttempts: 5,
            reconnect: true,
            ...options
        };

        this.events = new Pulse();

        /** @type {WebSocket} */
        this.ws = null;

        this.messageBuffer = new MessageBuffer(this);
        this.requests = new RequestsManager(this);
        this.methods = new MethodsManager(this);
        this.reconnectionManager = new ReconnectionManager(this, {
            delay: this.options.reconnectDelay,
            maxAttempts: this.options.maxReconnectAttempts
        });
        this.topics = new Pulse();
        this.topics.use(async (event) => {
            this.events.emit('topic:received', {
                topic: event.name,
                data: event.data,
                debug: {
                    message: `Received message for topic "${event.name}"`,
                    type: 'info'
                }
            });
        });

        this.hooks = new Pulse();

        this.recoveryToken = null;
    }

    get connected() {
        return this.ws?.readyState === WebSocket.OPEN;
    }

    get connecting() {
        return this.ws?.readyState === WebSocket.CONNECTING;
    }

    get closed() {
        return this.ws?.readyState === WebSocket.CLOSED;
    }

    get closing() {
        return this.ws?.readyState === WebSocket.CLOSING;
    }

    /**
     * @returns {'connecting'|'connected'|'closing'|'disconnected'}
     */
    get state() {
        if (!this.ws) return 'disconnected';

        switch (this.ws.readyState) {
            case WebSocket.CONNECTING: return 'connecting';
            case WebSocket.OPEN: return 'connected';
            case WebSocket.CLOSING: return 'closing';
            case WebSocket.CLOSED: return 'disconnected';
            default: return 'disconnected';
        }
    }

    /**
     * Connect to the WebSocket server
     * @returns {Promise<void>}
     */
    connect() {
        if (this.connected || this.connecting) {
            return Promise.reject(new Error('Already connected or connecting'));
        }


        if (this.recoveryToken) {
            this.url.searchParams.set('recover', this.recoveryToken);
        }

        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.url);

                this.ws.onopen = () => {
                    this.events.emit('starling:open', {
                        debug: {
                            message: 'Connection opened'
                        }
                    });
                    this.messageBuffer.flush();
                    resolve();
                };

                this.ws.onclose = () => {
                    this.events.emit('starling:close', {
                        debug: {
                            message: 'Connection closed'
                        }
                    });
                    if (this.options.reconnect) {
                        this.reconnectionManager.start();
                    }
                };

                this.ws.onerror = (error) => {
                    this.events.emit('starling:error', {
                        error,
                        debug: {
                            message: 'Connection error',
                            error
                        }
                    });
                    reject(error);
                    //TODO: Handle error properly
                };

                this.ws.onmessage = (event) => {
                    this.handleMessage(event.data);
                };

            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Close the WebSocket connection
     * @returns {Promise<void>}
     */
    disconnect() {
        if (!this.ws) return Promise.resolve();

        this.reconnectionManager.stop();
        this.requests.cancelAll();

        return new Promise((resolve) => {
            this.ws.onclose = () => {
                this.ws = null;
                resolve();
            };

            this.ws.close();
        });
    }

    /**
     * Register a method handler
     * @param {string} name
     * @param {function(RequestContext): Promise<void>} handler
     * @param {MethodOptions} options
     */
    method(name, handler, options = {}) {
        this.methods.add(name, handler, options);
    }


    /**
     * Demande un token d'état au serveur
     * @returns {Promise<string>} Le token de récupération
     */
    async sync() {
        try {
            const response = await this.request('starling:getToken');
            this.recoveryToken = response.token;
            return this.recoveryToken;
        } catch (error) {
            throw error;
        }
    }



    /**
     * Handle incoming WebSocket messages
     * @private
     * @param {string|ArrayBuffer|Blob} data
     */
    handleMessage(data) {
        if (typeof data === 'string') {
            try {
                const message = JSON.parse(data);
                this.handleJsonMessage(message);
            } catch (e) {
                this.handleTextMessage(data);
            }
        } else if (data instanceof ArrayBuffer) {
            this.handleBinaryMessage(data);
        }
    }

    /**
     * @private
     * @param {Object} message
     */
    handleJsonMessage(message) {
        console.log('Message', message);
        
        const result = StandardMessageSchema.safeParse(message);

        if (!result.success) {
            this.events.emit('message:invalid', {
                message,
                errors: result.error.errors,
                debug: {
                    message: 'Invalid message format',
                    type: 'error',
                    details: result.error.errors
                }
            });
            this.hooks.emit('json', {message});
            return;
        }

        const validMessage = result.data;

        // On émet un événement pour le message validé
        this.events.emit(`message:${validMessage.type}`, {
            message: validMessage,
            debug: {
                message: `Received ${validMessage.type} message`,
                type: 'info'
            }
        });

        switch (validMessage.type) {
            case 'request': {
                const method = this.methods.get(validMessage.method);
                if (!method) {
                    this.standard('error', {
                        requestId: validMessage.requestId,
                        error: {
                            code: 'METHOD_NOT_FOUND',
                            message: `Method "${validMessage.method}" not found`
                        }
                    });
                    return;
                }

                const context = new RequestContext(this, validMessage.payload, {
                    requestId: validMessage.requestId,
                    timestamp: validMessage.timestamp,
                    options: validMessage.options || {}
                });

                method.execute(context);
                break;
            }
            case 'response':
                this.requests.handleResponse(validMessage);
                break;
            case 'notification':
                console.log('Notification', validMessage);
                
                this.handleNotification(validMessage.notification);
                break;
            case 'error':
                // TODO: handleError(validMessage);
                break;

        }
    }

    /**
     * @private
     * @param {Object} notification Notification validée par le schema
     */
    handleNotification(notification) {
        console.log('Notification', notification);
        

        if (notification.type === 'starling:token') {
            this.recoveryToken = notification.data.token;
            return;
        } else if (notification.topic && notification.data) {
            this.topics.emit(notification.topic, notification.data);
            return;
        } else {
            this.hooks.emit('notification', {notification});
        }
    }

    /**
     * @private
     * @param {string} message
     */
    handleTextMessage(message) {
        this.hooks.emit('text', {message});
    }

    /**
     * @private
     * @param {ArrayBuffer} message
     */
    handleBinaryMessage(message) {
        this.hooks.emit('binary', {message});
    }


    /**
     * Subscribe to a topic for incoming messages from the server
     * @param topic {string}
     * @param handler {function(*)}
     * @returns {Listener}
     */
    on(topic, handler) {
        const listener = this.topics.on(topic, handler);
        listener.off = () => listener.remove();
        return listener;
    }

    /**
     * Send a message through the WebSocket
     * @param {string|ArrayBuffer} message
     * @returns {boolean} Whether the message was sent
     */
    send(message) {
        if (!this.connected) {
            return this.messageBuffer.add(message);
        }

        try {
            this.ws.send(message);
            return true;
        } catch (e) {
            return this.messageBuffer.add(message);
        }
    }

    /**
     * Send a JSON message through the WebSocket
     * @param {Object} message
     * @returns {boolean} Whether the message was sent
     */
    json(message) {
        try {
            return this.send(JSON.stringify(message));
        } catch (e) {
            return false;
        }
    }

    /**
     * Send a standard message through the WebSocket
     * @param type {'request'|'response'|'notification'|'error'} Message type
     * @param data {Object} Message payload
     * @returns {boolean}
     */
    standard = (type, data) => {
        return this.json(createStandardMessage(type, data));
    }

    /**
     * Send a request to the server
     * @param {string} method
     * @param {*} payload
     * @param {RequestOptions} options
     * @returns {Promise<*>}
     */
    async request(method, payload, options = {}) {
        const request = this.requests.create(method, payload, options);
        return request.execute();
    }


    /**
     * @typedef {import("@killiandvcz/pulse").Listener} Listener
     */

    /**
     * @typedef {import("@killiandvcz/pulse/models/event.model.js").Event} PulseEvent
     */

    /**
     * Hook pour intercepter les messages JSON non gérés par le protocole standard
     * @param {function(Object)} handler - Gestionnaire appelé avec le message JSON
     * @returns {Listener} Listener qui peut être retiré avec .off()
     */
    onjson = (handler) => this.hooks.on('json', event => {
        const {data: {message}} = event;
        handler(message);
    });

    /**
     * Hook pour intercepter les messages texte bruts (non-JSON)
     * @param {function(string)} handler - Gestionnaire appelé avec le message texte brut
     * @returns {Listener} Listener qui peut être retiré avec .off()
     */
    ontext = (handler) => this.hooks.on('text', event => {
        const {data: {message}} = event;
        handler(message);
    });

    /**
     * Hook pour intercepter les messages binaires
     * @param {function(ArrayBuffer)} handler - Gestionnaire appelé avec le message binaire
     * @returns {Listener} Listener qui peut être retiré avec .off()
     */
    onbinary = (handler) => this.hooks.on('binary', event => {
        const {data: {message}} = event;
        handler(message);
    });

    /**
     * Hook pour intercepter les notifications non gérées par le système de topics
     * @param {function(Object)} handler - Gestionnaire appelé avec la notification
     * @returns {Listener} Listener qui peut être retiré avec .off()
     */
    onnotification = (handler) => this.hooks.on('notification', event => {
        const {data: {notification}} = event;
        handler(notification);
    });

}

export default Starling;