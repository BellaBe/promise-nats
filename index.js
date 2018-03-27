const NATS = require('nats');
const shortid = require('shortid');

/**
 * @typedef {Object} Request
 * @property {Object} body
 */

/**
 * @typedef {Object} Response
 * @property {Object=} error
 * @property {Object=} body
 */

module.exports = class PromiseNats {
  /**
   * @param {Object} options
   * @param {string=} [options.name='']
   * @param {string=} options.user
   * @param {string=} options.pass
   */
  constructor (options) {
    this.nats = NATS.connect(options);
    this.name = options.name || shortid.generate();
  }

  /**
   * @param {string}
   * @param {Object} body
   * @return {Promise.<Response>}
   */
  request (event, body) {
    return new Promise((resolve, reject) => {
      this.nats.requestOne(event, JSON.stringify({ body }), {}, 1000, res => {
        try {
          if (res.code === NATS.REQ_TIMEOUT) throw Error('NATS.REQUEST_TIMEOUT');
          res = JSON.parse(res);
          if (!res.error && !res.body) throw Error('NATS.BAD_RESPONSE_FORMAT');
          if (res.error) return reject(data.error);
          return resolve(res);
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  /**
   * @param {string} event
   * @param {Function} handler
   */
  onRequest (event, handler) {
    this.nats.subscribe(event, { queue: this.nats.name }, async (req, eventReply) => {
      try {
        req = JSON.parse(req);
        const body = await handler(req);
        this.nats.publish(eventReply, JSON.stringify({ body: body }));
      } catch (e) {
        this.nats.publish(eventReply, JSON.stringify({ error: e }));
      }
    });
  }

  /**
   * @param {string} event
   * @param {Object} body
   */
  dispatch (event, body) {
    this.nats.publish(event, JSON.stringify({ body }));
  }

  /**
   * @param {string} event
   * @param {Function} handler
   */
  on (event, handler) {
    this.nats.subscribe(event, { queue: this.nats.name }, async msg => {
      try {
        const msg = JSON.parse(msg);
        try {
          await handler(msg);
        } catch (e) {
          console.log(`Event handler error for a message "${event}"`, e);
        }
      } catch (e) {
        console.log(`Bad JSON in a message "${event}"`, e);
      }
    });
  }
};