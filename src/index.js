import { Starling } from './core/starling';
import { 
  Protocol,
  CommonErrors,
  StandardMethods,
  NotificationCategory,
  TimeConstants
} from '@helios-starling/utils';

/**
 * Crée une nouvelle instance du client Starling
 * @param {string|URL} url URL du serveur WebSocket
 * @param {import('./core/starling').StarlingOptions} [options] Options de configuration
 * @returns {Starling} Nouvelle instance du client
 * 
 * @example
 * const client = createClient('ws://localhost:8080', {
 *   reconnect: true,
 *   debug: true
 * });
 * 
 * client.method('chat:receive', async (context) => {
 *   console.log(`Message reçu: ${context.payload.message}`);
 *   context.success({ received: true });
 * });
 * 
 * await client.connect();
 * 
 * // Faire une requête
 * const response = await client.request('chat:send', { 
 *   message: 'Hello!' 
 * });
 * 
 * // S'abonner à des notifications
 * client.subscribe('chat:typing', (data) => {
 *   console.log(`${data.user} est en train d'écrire...`);
 * });
 */
export function createClient(url, options = {}) {
  return new Starling(url, options);
}

/**
 * Utilitaires standards du protocole
 * @type {{
 *   protocol: {
 *     name: string,
 *     version: string,
 *     minVersion: string
 *   },
 *   notifications: Object<string, string>,
 *   methods: Object<string, string>,
 *   errors: Object<string, string>,
 *   timeouts: {
 *     REQUEST: number,
 *     MAX_REQUEST: number,
 *     MIN_RECONNECT: number,
 *     MAX_RECONNECT: number
 *   }
 * }}
 */
export const utils = {
  /**
   * Informations sur le protocole
   */
  protocol: {
    name: Protocol.NAME,
    version: Protocol.CURRENT_VERSION,
    minVersion: Protocol.MIN_VERSION
  },

  /**
   * Catégories de notifications standards
   */
  notifications: NotificationCategory,

  /**
   * Méthodes standards
   */
  methods: StandardMethods,

  /**
   * Codes d'erreur communs
   */
  errors: CommonErrors,

  /**
   * Constantes de temps
   */
  timeouts: {
    /** Timeout par défaut des requêtes (30 secondes) */
    REQUEST: TimeConstants.DEFAULT_REQUEST_TIMEOUT,
    
    /** Timeout maximum des requêtes (5 minutes) */
    MAX_REQUEST: TimeConstants.MAX_REQUEST_TIMEOUT,
    
    /** Délai minimum de reconnexion (100ms) */
    MIN_RECONNECT: TimeConstants.RECONNECT_MIN_DELAY,
    
    /** Délai maximum de reconnexion (30 secondes) */
    MAX_RECONNECT: TimeConstants.RECONNECT_MAX_DELAY
  }
};

// Export des classes principales
export { Starling };

// Types exports pour JSDoc
// export * from './types';