import { BaseStarling, BinaryMessageContext, createErrorResponse, createNotification, getCurrentTimestamp, handleMessage, JsonMessageContext, MethodsManager, RequestsManager, TextMessageContext, TopicsManager } from "@helios-starling/utils";
import { StateManager } from "../managers/state";
import { Buffer } from "@helios-starling/utils";
import { ReconnectionManager } from "../managers/reconnection";

/**
* @typedef {import('@helios-starling/utils').BaseStarlingOptions} BaseStarlingOptions
*/

/**
* @typedef {Object} StarlingOptions
* @property {number} [connectTimeout=10000] Connection timeout (ms)
* @property {boolean} [reconnect=true] Activer la reconnexion automatique
* @property {number} [reconnectDelay=1000] Délai avant tentative de reconnexion (ms)
* @property {number} [maxReconnectAttempts=5] Nombre maximum de tentatives de reconnexion
* @property {Object} [state] Options du StateManager
* @property {number} [state.refreshInterval] Intervalle de rafraîchissement
* @property {number} [state.minRefreshInterval] Intervalle minimum
* @property {number} [state.retryAttempts] Tentatives de retry
* @property {boolean} [state.forceRefreshOnReconnect] Forcer après reconnexion
*/

/**
* Client Starling instance
*/
export class Starling extends BaseStarling {
    
    /**
    * @param {string|URL} url
    * @param {BaseStarlingOptions & StarlingOptions} [options]
    */
    constructor(url, options = {}) {
        super(options);
        
        /** @type {URL} */
        this.url = url instanceof URL ? url : new URL(url);
        
        this._options = {
            connectTimeout: 10000,
            reconnect: true,
            reconnectDelay: 1000,
            maxReconnectAttempts: 5,
            state: {
                refreshInterval: 5 * 60 * 1000,
                minRefreshInterval: 60 * 1000,
                retryAttempts: 3,
                forceRefreshOnReconnect: true   
            },
            ...options
        }
        
        /** 
        * @private
        * @type {WebSocket}
        */
        this._ws = null;
        
        // Initialize components
        this._initializeComponents();
    }
    
    
    _initializeComponents() {
        
        this._stateManager = new StateManager(this, this._options?.state || {});
        this._buffer = new Buffer(this, this._options?.buffer || {});
        this._requests = new RequestsManager(this, this.events, this._options?.requests || {});
        
        this._methods = new MethodsManager(this.events, {
            
        });
        this._topics = new TopicsManager(this.events);
        
        this._reconnection = new ReconnectionManager(this, this._options.reconnection || {});
    }
    
    
    /**
    * Connects to the Helios server
    * @returns {Promise<void>}
    * @throws {Error}
    */
    async connect() {
        if (this.connected || this.connecting) {
            throw new Error('Already connected or connecting');
        }
        
        try {
            const token = this.state.token;
            if (token) {
                this.url.searchParams.set('recover', token);
            }
            
            return await new Promise((resolve, reject) => {
                this._ws = new WebSocket(this.url);
                
                this._ws.onopen = () => {
                    console.log('✨ Starling connected to Helios server');
                    
                    this._lastConnected = getCurrentTimestamp();
                    
                    this.events.emit('starling:connected', {
                        debug: {
                            type: 'connection',
                            message: `Starling ${this.id} connected`
                        }
                    });
                    
                    this._buffer.flush();
                    
                    resolve();
                };
                
                this._ws.onclose = () => this._handleClose();
                this._ws.onerror = error => this._handleError(error);
                this._ws.onmessage = message => this.handleMessage(message);
                
                // Timeout
                setTimeout(() => {
                    if (!this.connected) {
                        reject(new Error('Connection timeout'));
                    }
                }, this._options.connectTimeout || 10000);
            })
        } catch (error) {
            this.events.emit('starling:connect:failed', {
                error,
                debug: {
                    type: 'error',
                    message: `Failed to connect to Starling ${this.id}: ${error.message}`
                }
            });
            throw error;
        }
    }
    
    /**
    * Closes the WebSocket connection
    * @param {string} [reason] Reason for closing
    * @returns {Promise<void>}
    */
    async disconnect(reason = 'Connection closed') {
        if (!this._ws) return;
        
        this._reconnection.stop();
        this._requests.cancelAll(reason);
        this._buffer.clear();
        this._data.clear();
        
        
        return new Promise((resolve) => {
            const cleanup = () => {
                this._ws = null;
                resolve();
            };
            
            try {
                this._ws.onclose = cleanup;
                this._ws.close(1000, reason);
            } catch (error) {
                console.error('Failed to close connection:', error);
                cleanup();
            }
        })
    }
    
    
    async sync() {
        try {
            const token = await this._stateManager.refresh();
            return token;
        } catch (error) {
            throw new Error(`Failed to get recovery token: ${error.message}`);
        }
    }
    
    
    /**
    * Gère la fermeture de la connexion
    * @private
    */
    _handleClose() {
        this._ws = null;
        
        this._emitEvent('starling:disconnected', {
            lastConnected: this._lastConnected
        });
        
        if (this._options.reconnect) {
            this._reconnection.start();   
        }
    }
    
    /**
    * Émet un événement
    * @private
    */
    _emitEvent(type, data) {
        this.events.emit(type, {
            ...data,
            timestamp: getCurrentTimestamp()
        });
    }
    
    
    handleMessage = async message => {
        // console.log('📩 Starling received message:', message);
        
        handleMessage(this, message.data);
    }    
    
    _send(message) {
        
        try {
            const content = typeof message === 'object' && !(message instanceof ArrayBuffer)
            ? JSON.stringify(message)
            : message;

            this._events.emit('message:send:success', {
                starling: this,
                message,
                debug: {
                    type: 'message',
                    message: `Message sent: ${content}`
                }
            });
            
            this._ws.send(content);
            return true;
        } catch (error) {
            this._helios.events.emit('message:send:failed', {
                starling: this,
                error,
                debug: {
                    type: 'error',
                    message: `Failed to send message: ${error.message}`
                }
            });
        }
    }
    
    send(message) {
        
        return this._buffer.add(message);
    }
    
    /**
    * @param {string} topic
    * @param {*} data
    * @param {string} [requestId=null]
    */
    notify(topic, data, requestId = null) {
        this.send(createNotification(data, topic, { requestId }));
    }
    
    /**
    * @param {string} method
    * @param {Object} payload
    * @param {import('@helios-starling/utils').RequestOptions} [options={}]
    * @returns {import('@helios-starling/utils').Request}
    * @async
    */
    request(method, payload, options = {}) {
        return this._requests.execute(this, method, payload, options);
    }
    
    /**
    * @param {string} name
    * @param {import('@helios-starling/utils').MethodHandler} handler
    * @param {import('@helios-starling/utils').MethodOptions} [options]
    */
    method = (name, handler, options = {}) => {
        this._methods.register(name, handler, options);
    }
    
    /**
    * Listen on inbounding notifications
    * @param {string} topic
    * @param {function(import('@helios-starling/utils').NotificationContext): Promise<void>} handler
    * @param {import('@helios-starling/utils').TopicHandlerOptions} [options]
    */
    on = (topic, handler, options) => this._topics.subscribe(topic, handler, options);
    
    
    /**
    * Sends an error response
    * @param {string} code Error code
    * @param {string} message Error message
    * @param {Object} [details] Error details
    */
    sendError = (code, message, details = undefined) => {
        this.send(createErrorResponse(null, code, message, details));
    }
    
    
    
    /**
    * Handles incoming text messages that are not part of the Helios-Starling protocol
    * @param {(context: import('./context').TextMessageContext) => void} callback Text message handler
    */
    onText = (callback) => this._events.on('message:text', (event) => {
        const context = new TextMessageContext(event.starling, event.message);
        callback(context);
    });
    
    
    /**
    * Handles incoming JSON messages that are not part of the Helios-Starling protocol
    * @param {(context: import('./context').JsonMessageContext) => void} callback
    */
    onJson = (callback) => this._events.on('message:json', event => {
        const context = new JsonMessageContext(event.starling, event.data);
        callback(context);
    });
    
    /**
    * Handles incoming binary messages that are not part of the Helios-Starling protocol
    * @param {(context: import('./context').BinaryMessageContext) => void} callback
    */
    onBinary = (callback) => this._events.on('message:binary', event => {
        const context = new BinaryMessageContext(event.starling, event.data);
        callback(context);
    });
    
    
    /**
    * Gère les erreurs de connexion
    * @private
    */
    _handleError(error) {
        console.error('Starling error:', error);
        
        this._emitEvent('error', {
            error,
            timestamp: getCurrentTimestamp()
        });
    }
    
    
    get connected() {
        return this._ws && this._ws.readyState === WebSocket.OPEN;
    }
    
    get connecting() {
        return this._ws && this._ws.readyState === WebSocket.CONNECTING;
    }
    
    get closing() {
        return this._ws && this._ws.readyState === WebSocket.CLOSING;
    }
    
    get closed() {
        return this._ws && this._ws.readyState === WebSocket.CLOSED;
    }

}