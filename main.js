'use strict';

const utils = require('@iobroker/adapter-core');
const axios = require('axios');

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
		if(this.config.apikey) {
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
				this.log.debug(`TYPE: ${typeof(this.config.temperatureoffset)}`);
				for (const id of PoolsResponse.data) {
					//check if pooldevice has to be created
					this.log.info(`check if exists pooldevice: ${id.id}`);
					const obj = await this.getObjectAsync(PoolsResponse.data[poolcounter].id);
					if (obj == null) {
						this.log.info(`create new pooldevice: ${id.id}`);
						await this.CreatePoolDevice(PoolsResponse.data[poolcounter]);
						await this.UpdatePoolDevice(PoolsResponse.data[poolcounter], this.config.temperatureoffset, this.config.phoffset, this.config.orpoffset);
					}
					else
					{
						this.log.debug(`already exists pooldevice: ${id.id}`);
						//only update if measurement is valid
						if (PoolsResponse.data[poolcounter].latestMeasure.isValid) {
							//only update if measuredAt changed
							const obj = await this.getStateAsync(id.id+'.latestMeasure.measuredAt');
							if (obj != null) {
								if (obj.val != PoolsResponse.data[poolcounter].latestMeasure.measuredAt) {
									this.log.info(`new measurement from API => update states of pooldevice: ${id.id}`);
									await this.UpdatePoolDevice(PoolsResponse.data[poolcounter], this.config.temperatureoffset, this.config.phoffset, this.config.orpoffset);
								} else {
									this.log.info(`no new measurement from API for pooldevice: ${id.id}`);
								}
							} else {
								this.log.error(`could not get latest measurement timestamp from iobroker objects for pooldevice: ${id.id}`);
							}
						} else {
							this.log.info(`latest measurement is not valid for pooldevice: ${id.id}`);
						}
					}
					poolcounter++;
				}
			} catch (err) {
				//connection to API lost
				this.setState('info.connection',false,true);
				this.log.error('connection error to iopool-API: '+err);
			}
			this.log.info(`end iopooleco API request`);
		} else {
			this.log.error(`API-Key has to be set in the instance settings before usage`);
		}
		this.terminate(0);
	}

	/**
	 * @param {{ id: object; }} poolidobject
	 */
	async CreatePoolDevice(poolidobject) {
		this.log.debug(`create pooldevice: ${poolidobject.id}`);
		await this.createDeviceAsync(poolidobject.id);
		this.log.debug(`create states for pooldevice: ${poolidobject.id}`);
		await this.setObjectNotExistsAsync(poolidobject.id + '.title', { type: 'state', common: { name: poolidobject.id + '.title', type: 'string', read: true, write: false, role: 'value', desc: ''}, native: {} });
		await this.setObjectNotExistsAsync(poolidobject.id + '.mode', { type: 'state', common: { name: poolidobject.id + '.mode', type: 'string', read: true, write: false, role: 'value', desc: '' }, native: {} });
		await this.setObjectNotExistsAsync(poolidobject.id + '.hasAnActionRequired', { type: 'state', common: { name: poolidobject.id + '.hasAnActionRequired', type: 'boolean', read: true, write: false, role: 'value', desc: '' }, native: {} });
		await this.setObjectNotExistsAsync(poolidobject.id + '.latestMeasure.temperature', { type: 'state', common: { name: poolidobject.id + '.latestMeasure.temperature', type: 'number', unit: '\xB0C', read: true, write: false, role: 'value.temperature', desc: '' }, native: {} });
		await this.setObjectNotExistsAsync(poolidobject.id + '.latestMeasure.ph', { type: 'state', common: { name: poolidobject.id + '.latestMeasure.ph', type: 'number', read: true, write: false, role: 'value', desc: '' }, native: {} });
		await this.setObjectNotExistsAsync(poolidobject.id + '.latestMeasure.orp', { type: 'state', common: { name: poolidobject.id + '.latestMeasure.orp', type: 'number', unit: 'mV', read: true, write: false, role: 'value', desc: '' }, native: {} });
		await this.setObjectNotExistsAsync(poolidobject.id + '.latestMeasure.mode', { type: 'state', common: { name: poolidobject.id + '.latestMeasure.mode', type: 'string', read: true, write: false, role: 'value', desc: '' }, native: {} });
		await this.setObjectNotExistsAsync(poolidobject.id + '.latestMeasure.isValid', { type: 'state', common: { name: poolidobject.id + '.latestMeasure.isValid', type: 'boolean', read: true, write: false, role: 'value', desc: '' }, native: {} });
		await this.setObjectNotExistsAsync(poolidobject.id + '.latestMeasure.measuredAt', { type: 'state', common: { name: poolidobject.id + '.latestMeasure.measuredAt', type: 'string', read: true, write: false, role: 'value', desc: '' }, native: {} });
		await this.setObjectNotExistsAsync(poolidobject.id + '.advice.filtrationDuration', { type: 'state', common: { name: poolidobject.id + '.advice.filtrationDuration', type: 'number', read: true, write: false, role: 'value', desc: '' }, native: {} });
	}


	/**
	 * @param {{ id: string; title: string | number | boolean | ioBroker.State | ioBroker.SettableState | null; mode: string | number | boolean | ioBroker.State | ioBroker.SettableState | null; hasAnActionRequired: string | number | boolean | ioBroker.State | ioBroker.SettableState | null; latestMeasure: { temperature: number; ph: number; orp: number; mode: string | number | boolean | ioBroker.State | ioBroker.SettableState | null; isValid: string | number | boolean | ioBroker.State | ioBroker.SettableState | null; measuredAt: string | number | boolean | ioBroker.State | ioBroker.SettableState | null; } | null; advice: { filtrationDuration: string | number | boolean | ioBroker.State | ioBroker.SettableState | null; }; }} poolidobject
	 * @param {string | number} temperatureoffset
	 * @param {string | number} phoffset
	 * @param {string | number} orpoffset
	 */
	async UpdatePoolDevice(poolidobject, temperatureoffset, phoffset, orpoffset) {
		//update pooldevice with API values
		this.log.info(`update pooldevice: ${poolidobject.id}`);
		if ('title' in poolidobject) {await this.setState(poolidobject.id + '.title', poolidobject.title, true); }
		if ('mode' in poolidobject) {await this.setState(poolidobject.id + '.mode', poolidobject.mode, true); }
		if ('hasAnActionRequired' in poolidobject) {await this.setState(poolidobject.id + '.hasAnActionRequired', poolidobject.hasAnActionRequired, true); }
		if (poolidobject.latestMeasure != null) {
			if ('temperature' in poolidobject.latestMeasure) {await this.setState(poolidobject.id + '.latestMeasure.temperature', (poolidobject.latestMeasure.temperature + parseFloat(temperatureoffset)), true); }
			if ('ph' in poolidobject.latestMeasure) {await this.setState(poolidobject.id + '.latestMeasure.ph', (poolidobject.latestMeasure.ph + parseFloat(phoffset)), true); }
			if ('orp' in poolidobject.latestMeasure) {await this.setState(poolidobject.id + '.latestMeasure.orp', (poolidobject.latestMeasure.orp + parseFloat(orpoffset)), true); }
			if ('mode' in poolidobject.latestMeasure) {await this.setState(poolidobject.id + '.latestMeasure.mode', poolidobject.latestMeasure.mode, true); }
			if ('isValid' in poolidobject.latestMeasure) {await this.setState(poolidobject.id + '.latestMeasure.isValid', poolidobject.latestMeasure.isValid, true); }
			if ('measuredAt' in poolidobject.latestMeasure) {await this.setState(poolidobject.id + '.latestMeasure.measuredAt', poolidobject.latestMeasure.measuredAt, true); }
		}
		if ('filtrationDuration' in poolidobject.advice) {await this.setState(poolidobject.id + '.advice.filtrationDuration', poolidobject.advice.filtrationDuration, true); }
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

