import { BaseStarling, getCurrentTimestamp, NetworkNode } from "@helios-starling/utils";
import { StateManager } from "../managers/state";
import { ReconnectionManager } from "../managers/reconnection";
import { proxyConfiguration } from "../config/proxy.config";

/**
* @typedef {import('@helios-starling/utils').BaseStarlingOptions} BaseStarlingOptions
*/

/**
* @typedef {import("@helios-starling/utils").NetworkNodeOptions & {
*  connectTimeout: number=10000,
*  reconnect: boolean=true,
*  reconnectDelay: number=10000,
*  maxReconnectAttempts: number=5,
*  state: import("../managers/state").StateManagerOptions,
*  reconnection: import("../managers/reconnection").ReconnectionOptions
* }} StarlingOptions
*/


/**
* Client Starling instance
*/
export class Starling extends NetworkNode {
    /**
    * @param {string|URL} url
    * @param {StarlingOptions} options 
    */
    constructor(url, options = {}) {
        super({
            builtInMethods: {},
            proxyConfiguration
        }, {...options});
        

        this._options = {
            connectTimeout: 10000,
            reconnect: true,
            reconnectDelay: 10000,
            maxReconnectAttempts: 5,
            ...options
        }
        
        this.url = url instanceof URL ? url : new URL(url);
        
        this._starling = new BaseStarling({
            id: this.id,
            networkNode: this,
            ...options
        }, this.events);
        this._starling.events = this.events;
        
        this._stateManager = new StateManager(this, this._options?.state || {});
        this._reconnection = new ReconnectionManager(this, this._options.reconnection || {});

        this.send = this._starling.send.bind(this._starling);
        this.notify = this._starling.notify.bind(this._starling);
        this.request = this._starling.request.bind(this._starling);
        this.sendError = this._starling.sendError.bind(this._starling);
    }
    
    get _ws() {
        return this._starling._ws;
    }
    
    set _ws(ws) {
        this._starling._ws = ws;
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
                    
                    console.log('Starling connected');
                    
                    this._starling.events.emit('starling:connected', {
                        debug: {
                            type: 'connection',
                            message: `Starling connected`
                        }
                    });
                    
                    this._starling._buffer.flush();
                    
                    resolve();
                };
                
                this._ws.onclose = () => this._handleClose();
                this._ws.onerror = error => this._handleError(error);
                this._ws.onmessage = message => this._starling.handleMessage(message.data);
                
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
                    message: `Failed to connect to Starling: ${error.message}`
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
        this._starling._requests.cancelAll(reason);
        this._starling._buffer.flush();
        this._starling._data.clear();
        
        
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
        console.log('❌ Starling disconnected');
        
        this._emitEvent('starling:disconnected', {
            lastConnected: this._lastConnected,
            debug: {
                type: 'disconnection',
                message: `Starling disconnected`
            }
        });
        
        if (this._options.reconnect) {
            this._reconnection.start();   
        }
    }
    
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
    
    get createdAt() {
        return this._starling.createdAt;
    }

    get state() {
        return this._starling.state;
    }

    get isConnected() {
        return this._starling.isConnected;
    }

    get lastConnected() {
        return this._starling.lastConnected;
    }

    get data() {
        return this._starling.data;
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