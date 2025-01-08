// message-buffer.js

/**
 * @typedef BufferedMessage
 * @property {string|ArrayBuffer} content Message content
 * @property {number} timestamp Timestamp when message was buffered
 * @property {number} attempts Number of send attempts
 */

export class MessageBuffer {
    /**
     * @param {Starling} starling
     */
    constructor(starling) {
        this.starling = starling;
        /** @type {BufferedMessage[]} */
        this.messages = [];
        /** @type {number} */
        this.maxSize = 1000;
    }

    /**
     * @returns {boolean}
     */
    get isFull() {
        return this.messages.length >= this.maxSize;
    }

    /**
     * @param {string|ArrayBuffer} message
     * @returns {boolean}
     */
    add(message) {
        if (this.isFull) {
            this.starling.events.emit('buffer:full', {
                debug: {
                    message: 'Message buffer is full, dropping oldest message',
                    type: 'warning'
                }
            });
            this.messages.shift();
        }

        this.messages.push({
            content: message,
            timestamp: Date.now(),
            attempts: 0
        });

        this.starling.events.emit('buffer:added', {
            size: this.messages.length,
            debug: {
                message: `Message added to buffer (${this.messages.length}/${this.maxSize})`,
                type: 'info'
            }
        });

        return true;
    }

    flush() {
        if (!this.starling.connected) return;

        const remaining = [];
        let sent = 0;

        for (const message of this.messages) {
            try {
                this.starling.ws.send(message.content);
                message.attempts++;
                sent++;
            } catch (e) {
                remaining.push(message);
            }
        }

        this.messages = remaining;

        if (sent > 0) {
            this.starling.events.emit('buffer:flushed', {
                sent,
                remaining: this.messages.length,
                debug: {
                    message: `Flushed ${sent} messages, ${this.messages.length} remaining`,
                    type: 'info'
                }
            });
        }
    }

    clear() {
        const size = this.messages.length;
        this.messages = [];

        if (size > 0) {
            this.starling.events.emit('buffer:cleared', {
                cleared: size,
                debug: {
                    message: `Cleared ${size} messages from buffer`,
                    type: 'info'
                }
            });
        }
    }
}