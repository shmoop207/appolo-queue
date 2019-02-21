"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const Q = require("bluebird");
const _ = require("lodash");
const util = require("util");
const Redis = require("ioredis");
const appolo_event_dispatcher_1 = require("appolo-event-dispatcher");
const events_1 = require("./events");
class Client extends appolo_event_dispatcher_1.EventDispatcher {
    constructor(_options) {
        super();
        this._options = _options;
    }
    get _getQueueSet() {
        return `${this._options.queueName}_set_{1}`;
    }
    get _getQueueHash() {
        return `${this._options.queueName}_hash_{1}`;
    }
    async connect() {
        let params = { enableReadyCheck: true, lazyConnect: true, keepAlive: 1000 };
        this._client = new Redis(this._options.redis, params);
        this._sub = new Redis(this._options.redis, params);
        this._sub.subscribe(this._options.queueName);
        this._sub.on("message", this._onMessage.bind(this));
        let fsAsync = util.promisify(fs.readFile);
        let script = await Q.props({
            "get_jobs": fsAsync(path.resolve(__dirname, "lua/get_jobs.lua"), { encoding: "utf8" }),
            "set_job": fsAsync(path.resolve(__dirname, "lua/set_job.lua"), { encoding: "utf8" }),
            "del_job": fsAsync(path.resolve(__dirname, "lua/del_job.lua"), { encoding: "utf8" })
        });
        _.forEach(script, (value, key) => this._client.defineCommand(key, { numberOfKeys: 2, lua: value }));
    }
    _onMessage(channel, message) {
        let data = JSON.parse(message);
        this.fireEvent(`${events_1.Events.ClientMessage}`, data);
        this.fireEvent(`${events_1.Events.ClientMessage}:${data.job.id}`, data);
    }
    publish(eventName, job, result = null) {
        this._client.publish(this._options.queueName, JSON.stringify({ eventName, job, result })).catch();
    }
    async getJobsByDate(date, limit, lock) {
        let results = await this._client['get_jobs'](this._getQueueSet, this._getQueueHash, date, limit, lock);
        if (!results || !results.length) {
            return [];
        }
        return _.map(results, item => JSON.parse(item));
    }
    async removeJob(id) {
        await this._client['del_job'](this._getQueueSet, this._getQueueHash, id);
    }
    async getJob(id) {
        let data = await this._client.hget(this._getQueueHash, id);
        if (!data) {
            return null;
        }
        let jobParams = JSON.parse(data);
        return jobParams;
    }
    async setJobTime(id, time) {
        await this._client.zadd(this._getQueueSet, time.toString(), id);
    }
    async setJob(job, nextRun) {
        await this._client['set_job'](this._getQueueSet, this._getQueueHash, nextRun, job.id, JSON.stringify(job));
    }
    async getAllJobs() {
        let jobs = await this._client.hvals(this._getQueueHash);
        return _.map(jobs, item => JSON.parse(item));
    }
    async hasJob(id) {
        let bool = await this._client.hexists(this._getQueueHash, id);
        return !!bool;
    }
    async purge() {
        await Q.all([
            this._client.del(this._getQueueHash),
            this._client.del(this._getQueueSet)
        ]);
    }
    async quit() {
        await Q.all([this._client.quit(), this._sub.quit()]);
    }
}
exports.Client = Client;
//# sourceMappingURL=client.js.map