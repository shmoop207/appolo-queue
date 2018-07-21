"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const redis = require("redis");
const fs = require("fs");
const path = require("path");
const Q = require("bluebird");
const _ = require("lodash");
const Scripto = require("redis-scripto");
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
    connect() {
        return new Promise(async (resolve, reject) => {
            let params = { no_ready_check: true, socket_keepalive: true };
            this._client = redis.createClient(this._options.redis, params);
            this._sub = redis.createClient(this._options.redis, params);
            this._sub.subscribe(this._options.queueName);
            this._sub.on("message", this._onMessage.bind(this));
            this._client.on('connect', () => {
                resolve();
            });
            this._client.on('error', (error) => {
                reject(error);
            });
            let scripto = this.scripto = new Scripto(this._client);
            let script = await Q.props({
                "get_jobs": Q.fromCallback(c => fs.readFile(path.resolve(__dirname, "lua/get_jobs.lua"), { encoding: "utf8" }, c)),
                "set_job": Q.fromCallback(c => fs.readFile(path.resolve(__dirname, "lua/set_job.lua"), { encoding: "utf8" }, c)),
                "del_job": Q.fromCallback(c => fs.readFile(path.resolve(__dirname, "lua/del_job.lua"), { encoding: "utf8" }, c))
            });
            scripto.load(script);
        });
    }
    _onMessage(channel, message) {
        let data = JSON.parse(message);
        this.fireEvent(`${events_1.Events.ClientMessage}`, data);
        this.fireEvent(`${events_1.Events.ClientMessage}:${data.job.id}`, data);
    }
    publish(eventName, job, result = null) {
        this._client.publish(this._options.queueName, JSON.stringify({ eventName, job, result }));
    }
    async getJobsByDate(date, limit, lock) {
        let results = await Q.fromCallback(c => this.scripto.run('get_jobs', [this._getQueueSet, this._getQueueHash], [date, limit, lock], c));
        if (!results || !results.length) {
            return [];
        }
        return _.map(results, item => JSON.parse(item));
    }
    async removeJob(id) {
        await Q.fromCallback(c => this.scripto.run('del_job', [this._getQueueSet, this._getQueueHash], [id], c));
    }
    async getJob(id) {
        let data = await Q.fromCallback(c => this._client.hget(this._getQueueHash, id, c));
        if (!data) {
            return null;
        }
        let jobParams = JSON.parse(data);
        return jobParams;
    }
    async setJobTime(id, time) {
        await Q.fromCallback(c => this._client.zadd(this._getQueueSet, time, id, c));
    }
    async setJob(job, nextRun) {
        await Q.fromCallback(c => this.scripto.run('set_job', [this._getQueueSet, this._getQueueHash], [nextRun, job.id, JSON.stringify(job)], c));
    }
    async getAllJobs() {
        let jobs = await Q.fromCallback(c => this._client.hvals(this._getQueueHash, c));
        return _.map(jobs, item => JSON.parse(item));
    }
    async hasJob(id) {
        let bool = await Q.fromCallback(c => this._client.hexists(this._getQueueHash, id, c));
        return bool;
    }
    async purge() {
        await Q.all([
            Q.fromCallback(c => this._client.del(this._getQueueHash, c)),
            Q.fromCallback(c => this._client.del(this._getQueueSet, c))
        ]);
    }
    async quit() {
        await Q.all([
            Q.fromCallback(c => this._client.quit(c)),
            Q.fromCallback(c => this._sub.quit(c))
        ]);
    }
}
exports.Client = Client;
//# sourceMappingURL=client.js.map