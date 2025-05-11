/**
* @typedef {import('@helios-starling/utils').BaseStarlingOptions} BaseStarlingOptions
*/
/**
* @typedef {import("@helios-starling/utils").NetworkNodeOptions & {
*  connectTimeout: number=10000,
*  state: import("../managers/state").StateManagerOptions,
*  reconnection: import("../managers/reconnection").ReconnectionOptions | false
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
    constructor(url: string | URL, options?: StarlingOptions);
    _options: {
        /**
         * Enable debug mode
         */
        debug?: boolean;
        connectTimeout: number;
        state: import("../managers/state").StateManagerOptions;
        reconnection: import("../managers/reconnection").ReconnectionOptions | false;
    };
    url: URL;
    _starling: BaseStarling;
    _stateManager: StateManager;
    _reconnection: ReconnectionManager;
    send: any;
    notify: any;
    request: any;
    sendError: any;
    set _ws(ws: any);
    get _ws(): any;
    /**
    * Connects to the Helios server
    * @returns {Promise<void>}
    * @throws {Error}
    */
    connect(): Promise<void>;
    _lastConnected: number;
    /**
    * Closes the WebSocket connection
    * @param {string} [reason] Reason for closing
    * @returns {Promise<void>}
    */
    disconnect(reason?: string): Promise<void>;
    sync(): Promise<string>;
    /**
    * Gère la fermeture de la connexion
    * @private
    */
    private _handleClose;
    /**
    * Gère les erreurs de connexion
    * @private
    */
    private _handleError;
    /**
    * Émet un événement
    * @private
    */
    private _emitEvent;
    onconnected: (handler: any) => any;
    ondisconnected: (handler: any) => any;
    onstatechange: (handler: any) => any;
    get createdAt(): number;
    get state(): "connected" | "connecting" | "disconnected" | "closing";
    get isConnected(): boolean;
    get lastConnected(): any;
    get data(): Map<any, any>;
    get connected(): boolean;
    get connecting(): boolean;
    get closing(): boolean;
    get closed(): boolean;
}
export type BaseStarlingOptions = import("@helios-starling/utils").BaseStarlingOptions;
export type StarlingOptions = import("@helios-starling/utils").NetworkNodeOptions & {
    connectTimeout: number;
    state: import("../managers/state").StateManagerOptions;
    reconnection: import("../managers/reconnection").ReconnectionOptions | false;
};
import { NetworkNode } from "@helios-starling/utils";
import { BaseStarling } from "@helios-starling/utils";
import { StateManager } from "../managers/state";
import { ReconnectionManager } from "../managers/reconnection";
