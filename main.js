'use strict';

const utils = require('@iobroker/adapter-core');
const axios = require('axios').default;

class Iopooleco extends utils.Adapter {
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super({
			...options,
			name: 'iopooleco',
		});
		this.pollInterval = 0;
		this.devices = [];
		this.pollTimeout = null;
		this.unloaded = false;
		this.on('ready', this.onReady.bind(this));
		this.on('unload', this.onUnload.bind(this));
	}

	async onReady() {
		this.log.info(`start iopooleco API request`);
		this.log.debug(`API-Key: ${this.config.apikey}`);
		this.iopoolAPIClient = axios.create({
			baseURL: 'https://api.iopool.com/v1/pools',
			timeout: 1000,
			responseType: 'json',
			responseEncoding: 'utf8',
			headers: {'x-api-key': `${this.config.apikey}`}
		});
		try {
			const PoolsResponse = await this.iopoolAPIClient.get('/');
			//connection to API established
			this.setState('info.connection',true,true);
			this.log.debug(`API-Response: ${JSON.stringify(PoolsResponse.status)}: ${JSON.stringify(PoolsResponse.data)}`);
			let poolcounter = 0;
			for (const id of PoolsResponse.data) {
				await this.CreatePoolIDNotExists(id.id);
				await this.UpdatePoolID(PoolsResponse.data[poolcounter]);
				poolcounter++;
			}
		} catch (err) {
			//connection to API lost
			this.setState('info.connection',false,true);
			this.log.error('connection error to iopool-API: '+err);
		}
		this.log.info(`end iopooleco API request`);
		this.terminate(0);
	}

	/**
	 * @param {string} poolid
	 */
	async CreatePoolIDNotExists(poolid) {
		//check if pooldevice has to be created
		this.log.info(`check if exists pooldevice: ${poolid}`);
		const obj = await this.getObjectAsync(poolid);
		if (obj == null) {
			this.log.debug(`create pooldevice: ${poolid}`);
			await this.createDeviceAsync(poolid);
			this.log.debug(`create states for pooldevice: ${poolid}`);
			await this.setObjectNotExistsAsync(poolid + '.title', { type: 'state', common: { name: poolid + '.title', type: 'string', read: true, write: false, role: 'value', desc: ''}, native: {} });
			await this.setObjectNotExistsAsync(poolid + '.mode', { type: 'state', common: { name: poolid + '.mode', type: 'string', read: true, write: false, role: 'value', desc: '' }, native: {} });
			await this.setObjectNotExistsAsync(poolid + '.hasAnActionRequired', { type: 'state', common: { name: poolid + '.hasAnActionRequired', type: 'boolean', read: true, write: false, role: 'value', desc: '' }, native: {} });
			await this.setObjectNotExistsAsync(poolid + '.latestMeasure.temperature', { type: 'state', common: { name: poolid + '.latestMeasure.temperature', type: 'number', unit: '\xB0C', read: true, write: false, role: 'value.temperature', desc: '' }, native: {} });
			await this.setObjectNotExistsAsync(poolid + '.latestMeasure.ph', { type: 'state', common: { name: poolid + '.latestMeasure.ph', type: 'number', read: true, write: false, role: 'value', desc: '' }, native: {} });
			await this.setObjectNotExistsAsync(poolid + '.latestMeasure.orp', { type: 'state', common: { name: poolid + '.latestMeasure.orp', type: 'number', unit: 'mV', read: true, write: false, role: 'value', desc: '' }, native: {} });
			await this.setObjectNotExistsAsync(poolid + '.latestMeasure.mode', { type: 'state', common: { name: poolid + '.latestMeasure.mode', type: 'string', read: true, write: false, role: 'value', desc: '' }, native: {} });
			await this.setObjectNotExistsAsync(poolid + '.latestMeasure.isValid', { type: 'state', common: { name: poolid + '.latestMeasure.isValid', type: 'boolean', read: true, write: false, role: 'value', desc: '' }, native: {} });
			await this.setObjectNotExistsAsync(poolid + '.latestMeasure.measuredAt', { type: 'state', common: { name: poolid + '.latestMeasure.measuredAt', type: 'string', read: true, write: false, role: 'value', desc: '' }, native: {} });
			await this.setObjectNotExistsAsync(poolid + '.advice.filtrationDuration', { type: 'state', common: { name: poolid + '.advice.filtrationDuration', type: 'string', read: true, write: false, role: 'value', desc: '' }, native: {} });
		} else {
			this.log.debug(`already exists pooldevice: ${poolid}`);
		}
	}

	/**
	 * @param {object} poolidobject
	 */
	async UpdatePoolID(poolidobject) {
		//update pooldevice with API values
		this.log.info(`update pooldevice: ${poolidobject.id}`);
		if ('title' in poolidobject) {this.setState(poolidobject.id + '.title', poolidobject.title, true); }
		if ('mode' in poolidobject) {this.setState(poolidobject.id + '.mode', poolidobject.mode, true); }
		if ('hasAnActionRequired' in poolidobject) {this.setState(poolidobject.id + '.hasAnActionRequired', poolidobject.hasAnActionRequired, true); }
		if (poolidobject.latestMeasure != null) {
			if ('temperature' in poolidobject.latestMeasure) {this.setState(poolidobject.id + '.latestMeasure.temperature', poolidobject.latestMeasure.temperature, true); }
			if ('ph' in poolidobject.latestMeasure) {this.setState(poolidobject.id + '.latestMeasure.ph', poolidobject.latestMeasure.ph, true); }
			if ('orp' in poolidobject.latestMeasure) {this.setState(poolidobject.id + '.latestMeasure.orp', poolidobject.latestMeasure.orp, true); }
			if ('mode' in poolidobject.latestMeasure) {this.setState(poolidobject.id + '.latestMeasure.mode', poolidobject.latestMeasure.mode, true); }
			if ('isValid' in poolidobject.latestMeasure) {this.setState(poolidobject.id + '.latestMeasure.isValid', poolidobject.latestMeasure.isValid, true); }
			if ('measuredAt' in poolidobject.latestMeasure) {this.setState(poolidobject.id + '.latestMeasure.measuredAt', poolidobject.latestMeasure.measuredAt, true); }
		}
		if ('filtrationDuration' in poolidobject.advice) {this.setState(poolidobject.id + '.advice.filtrationDuration', poolidobject.advice.filtrationDuration, true); }
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			// Here you must clear all timeouts or intervals that may still be active
			// clearTimeout(timeout1);
			// clearTimeout(timeout2);
			// ...
			// clearInterval(interval1);
			callback();
		} catch (e) {
			callback();
		}
	}
}



if (require.main !== module) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	module.exports = (options) => new Iopooleco(options);
} else {
	// otherwise start the instance directly
	new Iopooleco();
}

