// managers/reconnection.js

import { getCurrentTimestamp, TimeConstants } from '@helios-starling/utils';

/**
* @typedef {Object} ReconnectionOptions
* @property {number} [minDelay=100] Délai minimum entre les tentatives (ms)
* @property {number} [maxDelay=30000] Délai maximum entre les tentatives (ms)
* @property {number} [maxAttempts=Infinity] Nombre maximum de tentatives
* @property {number} [backoffMultiplier=1.5] Multiplicateur pour le backoff exponentiel
* @property {number} [resetThreshold=60000] Temps avant reset du compteur de tentatives (ms)
* @property {boolean} [debug=false] Active les logs de debug
*/

/**
* @typedef {Object} ReconnectionMetrics
* @property {number} attempts Nombre de tentatives depuis le dernier reset
* @property {number} totalAttempts Nombre total de tentatives
* @property {number} successfulReconnections Nombre de reconnexions réussies
* @property {number} failedAttempts Nombre de tentatives échouées
* @property {number} lastAttempt Timestamp de la dernière tentative
* @property {number} lastSuccess Timestamp de la dernière reconnexion réussie
* @property {number} lastReset Timestamp du dernier reset
* @property {number} averageAttemptDuration Durée moyenne des tentatives (ms)
* @property {number} currentDelay Délai actuel entre les tentatives (ms)
*/

/**
* Gère la logique de reconnexion avec backoff exponentiel
*/
export class ReconnectionManager {
  /**
  * @param {import('../core/starling').Starling} starling Instance Starling
  * @param {ReconnectionOptions} [options] Options de configuration
  */
  constructor(starling, options = {}) {
    /** @private */
    this._starling = starling;
    
    /** @private */
    this._options = {
      minDelay: TimeConstants.RECONNECT_MIN_DELAY,
      maxDelay: TimeConstants.RECONNECT_MAX_DELAY,
      maxAttempts: Infinity,
      backoffMultiplier: 1.5,
      resetThreshold: 60000,
      debug: false,
      ...options
    };
    
    /** @private */
    this._metrics = {
      attempts: 0,
      totalAttempts: 0,
      successfulReconnections: 0,
      failedAttempts: 0,
      lastAttempt: null,
      lastSuccess: null,
      lastReset: getCurrentTimestamp(),
      attemptDurations: [], // Pour calculer la moyenne
      currentDelay: this._options.minDelay
    };
    
    /** @private */
    this._timeoutId = null;
    
    /** @private */
    this._active = false;
    
    /** @private */
    this._currentAttempt = null;
    
    // Lier les event handlers
    this._bindEvents();
  }
  
  /**
  * Démarre le processus de reconnexion
  * @returns {Promise<void>}
  */
  async start() {
    if (this._active) {
      this._debug('Reconnection already in progress');
      return;
    }
    
    this._active = true;
    this._resetIfNeeded();
    await this._scheduleNextAttempt();
  }
  
  /**
  * Arrête le processus de reconnexion
  */
  stop() {
    this._active = false;
    
    if (this._timeoutId) {
      clearTimeout(this._timeoutId);
      this._timeoutId = null;
    }
    
    if (this._currentAttempt) {
      this._currentAttempt.abort();
      this._currentAttempt = null;
    }
    
    this._debug('Reconnection stopped');
  }
  
  /**
  * Force une tentative de reconnexion immédiate
  * @returns {Promise<void>}
  */
  async forceAttempt() {
    if (this._currentAttempt) {
      this.stop();
    }
    
    this._active = true;
    return this._attemptReconnection();
  }
  
  /**
  * Réinitialise le manager
  */
  reset() {
    this.stop();
    this._metrics = {
      attempts: 0,
      totalAttempts: 0,
      successfulReconnections: 0,
      failedAttempts: 0,
      lastAttempt: null,
      lastSuccess: null,
      lastReset: getCurrentTimestamp(),
      attemptDurations: [],
      currentDelay: this._options.minDelay
    };
    this._debug('Reconnection manager reset');
  }
  
  /**
  * Récupère les métriques de reconnexion
  * @returns {ReconnectionMetrics}
  */
  getMetrics() {
    const avgDuration = this._metrics.attemptDurations.length > 0
    ? this._metrics.attemptDurations.reduce((a, b) => a + b, 0) / this._metrics.attemptDurations.length
    : 0;
    
    return {
      attempts: this._metrics.attempts,
      totalAttempts: this._metrics.totalAttempts,
      successfulReconnections: this._metrics.successfulReconnections,
      failedAttempts: this._metrics.failedAttempts,
      lastAttempt: this._metrics.lastAttempt,
      lastSuccess: this._metrics.lastSuccess,
      lastReset: this._metrics.lastReset,
      averageAttemptDuration: avgDuration,
      currentDelay: this._metrics.currentDelay
    };
  }
  
  /**
  * @private
  */
  _bindEvents() {
    // Reset lors d'une connexion réussie
    this._starling.events.on('starling:connected', () => {
      const now = getCurrentTimestamp();
      
      if (this._metrics.lastAttempt) {
        const duration = now - this._metrics.lastAttempt;
        this._metrics.attemptDurations.push(duration);
        
        // Garder seulement les 10 dernières durées pour la moyenne
        if (this._metrics.attemptDurations.length > 10) {
          this._metrics.attemptDurations.shift();
        }
      }
      
      this._metrics.lastSuccess = now;
      this._metrics.successfulReconnections++;
      
      this.stop();
    });
  }
  
  /**
  * @private
  */
  async _scheduleNextAttempt() {
    if (!this._active) return;
    
    if (this._metrics.attempts >= this._options.maxAttempts) {
      this._emitMaxAttemptsReached();
      this.stop();
      return;
    }
    
    // Calculer le délai avec backoff exponentiel
    const delay = Math.min(
      this._metrics.currentDelay * this._options.backoffMultiplier,
      this._options.maxDelay
    );
    
    this._metrics.currentDelay = delay;
    
    this._debug(`Scheduling next attempt in ${delay}ms`);
    
    this._emitAttemptScheduled();
    
    await new Promise(resolve => {
      this._timeoutId = setTimeout(resolve, delay);
    });
    
    if (this._active) {
      await this._attemptReconnection();
    }
  }
  
  /**
  * @private
  */
  async _attemptReconnection() {
    if (!this._active) return;
    
    const attemptStart = getCurrentTimestamp();
    this._metrics.attempts++;
    this._metrics.totalAttempts++;
    this._metrics.lastAttempt = attemptStart;
    
    try {
      this._emitAttemptStarted();
      
      // Créer une promesse qui peut être annulée
      this._currentAttempt = new AbortController();
      
      await Promise.race([
        this._starling.connect().then(() => {
          console.log("✨ Reconnection attempt successful");
          
        }),
        new Promise((_, reject) => {
          this._currentAttempt.signal.addEventListener('abort', () => {
            reject(new Error('Reconnection attempt aborted'));
          });
        })
      ]);
    } catch (error) {
      if (error.message === 'Reconnection attempt aborted') {
        this._debug('Reconnection attempt aborted');
        return;
      }
      
      this._metrics.failedAttempts++;
      this._emitAttemptFailed(error);
      
      // Planifier la prochaine tentative
      await this._scheduleNextAttempt();
    } finally {
      this._currentAttempt = null;
    }
  }
  
  /**
  * @private
  */
  _resetIfNeeded() {
    const now = getCurrentTimestamp();
    if (this._metrics.lastReset && (now - this._metrics.lastReset) >= this._options.resetThreshold) {
      this._debug('Resetting attempt counter due to threshold');
      this._metrics.attempts = 0;
      this._metrics.currentDelay = this._options.minDelay;
      this._metrics.lastReset = now;
    }
  }
  
  /**
  * @private
  */
  _emitAttemptScheduled() {
    this._starling.events.emit('starling:reconnect:scheduled', {
      metrics: this.getMetrics(),
      debug: {
        type: 'info',
        message: `Reconnection attempt ${this._metrics.attempts + 1} scheduled in ${this._metrics.currentDelay}ms`
      }
    });
  }
  
  /**
  * @private
  */
  _emitAttemptStarted() {
    console.log("🚀 Reconnection attempt started");
    
    this._starling.events.emit('starling:reconnect:attempt', {
      attempt: this._metrics.attempts,
      metrics: this.getMetrics(),
      debug: {
        type: 'info',
        message: `Starting reconnection attempt ${this._metrics.attempts}`
      }
    });
  }
  
  /**
  * @private
  */
  _emitAttemptFailed(error) {
    this._starling.events.emit('starling:reconnect:failed', {
      attempt: this._metrics.attempts,
      error,
      metrics: this.getMetrics(),
      debug: {
        type: 'error',
        message: `Reconnection attempt ${this._metrics.attempts} failed: ${error.message}`
      }
    });
  }
  
  /**
  * @private
  */
  _emitMaxAttemptsReached() {
    this._starling.events.emit('starling:reconnect:max_attempts', {
      metrics: this.getMetrics(),
      debug: {
        type: 'warning',
        message: `Maximum reconnection attempts (${this._options.maxAttempts}) reached`
      }
    });
  }
  
  /**
  * @private
  */
  _debug(message) {
    if (this._options.debug) {
      this._starling.events.emit('starling:reconnect:debug', {
        message,
        timestamp: getCurrentTimestamp(),
        debug: {
          type: 'debug',
          message: `[ReconnectionManager] ${message}`
        }
      });
    }
  }
}