// models/message.model.js

/**
 * @typedef StandardMessage
 * @property {'request'|'response'|'notification'|'error'} type
 * @property {string} protocol Toujours 'helios-starling'
 * @property {string} version Format semver
 * @property {number} timestamp
 */

/**
 * @typedef RequestMessage
 * @property {string} requestId UUID de la requête
 * @property {string} method Nom de la méthode
 * @property {*} payload Données de la requête
 */

/**
 * @typedef ResponseMessage
 * @property {string} requestId UUID de la requête d'origine
 * @property {boolean} success
 * @property {*} [data] Données de la réponse si succès
 * @property {{ code: string, message: string }} [error] Erreur si échec
 */