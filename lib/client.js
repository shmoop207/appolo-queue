"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Client = void 0;
const fs = require("fs");
const path = require("path");
const util = require("util");
const ioredis_1 = require("ioredis");
const events_1 = require("@appolo/events");
const events_2 = require("./events");
class Client extends events_1.EventDispatcher {
    constructor(_options) {
        super();
        this._options = _options;
        this._isDestroyed = false;
    }
    get _queueSetKey() {
        return `${this._options.queueName}_set_{1}`;
    }
    get _queueRunningSetKey() {
        return `${this._options.queueName}_set_running_{1}`;
    }
    get _queueHashKey() {
        return `${this._options.queueName}_hash_{1}`;
    }
    async connect() {
        let params = { enableReadyCheck: true, lazyConnect: true, keepAlive: 1000 };
        let conn = new URL(this._options.redis);
        if (conn.protocol == "rediss:") {
            params.tls = true;
        }
        params.host = conn.hostname;
        params.port = parseInt(conn.port);
        params.password = conn.password;
        this._client = new ioredis_1.default(this._options.redis, params);
        this._sub = new ioredis_1.default(this._options.redis, params);
        await Promise.all([this._client.connect(), this._sub.connect()]);
        this._sub.subscribe(this._options.queueName);
        this._sub.on("message", this._onMessage.bind(this));
        let fsAsync = util.promisify(fs.readFile);
        let scriptNames = ["get_jobs", "set_job", "del_job"];
        let scripts = await Promise.all([
            fsAsync(path.resolve(__dirname, "lua/get_jobs.lua"), { encoding: "utf8" }),
            fsAsync(path.resolve(__dirname, "lua/set_job.lua"), { encoding: "utf8" }),
            fsAsync(path.resolve(__dirname, "lua/del_job.lua"), { encoding: "utf8" })
        ]);
        scripts.forEach((value, index) => this._client.defineCommand(scriptNames[index], {
            numberOfKeys: 3,
            lua: value
        }));
    }
    _onMessage(channel, message) {
        if (this._isDestroyed) {
            return;
        }
        let data = JSON.parse(message);
        this.fireEvent(`${events_2.Events.ClientMessage}`, data);
        this.fireEvent(`${events_2.Events.ClientMessage}:${data.job.id}`, data);
    }
    publish(eventName, job, result = null) {
        if (this._isDestroyed) {
            return;
        }
        this._client.publish(this._options.queueName, JSON.stringify({ eventName, job, result })).catch();
    }
    async getJobsByDate(date, limit, lock) {
        let results = await this._client['get_jobs'](this._queueSetKey, this._queueHashKey, this._queueRunningSetKey, date, limit, Date.now() + lock);
        if (!results || !results.length) {
            return [];
        }
        return results.map(item => JSON.parse(item));
    }
    async removeJob(id) {
        await this._client['del_job'](this._queueSetKey, this._queueHashKey, this._queueRunningSetKey, id);
    }
    async getJob(id) {
        let data = await this._client.hget(this._queueHashKey, id);
        if (!data) {
            return null;
        }
        let jobParams = JSON.parse(data);
        return jobParams;
    }
    async setJobTime(id, time) {
        await this._client.zadd(this._queueSetKey, time.toString(), id);
    }
    async setJob(job, nextRun) {
        await this._client['set_job'](this._queueSetKey, this._queueHashKey, this._queueRunningSetKey, nextRun, job.id, JSON.stringify(job));
    }
    async getAllJobs() {
        let jobs = await this._client.hvals(this._queueHashKey);
        return (jobs || []).map(item => JSON.parse(item));
    }
    async hasJob(id) {
        let bool = await this._client.hexists(this._queueHashKey, id);
        return !!bool;
    }
    async purge() {
        await Promise.all([
            this._client.del(this._queueHashKey),
            this._client.del(this._queueSetKey),
            this._client.del(this._queueRunningSetKey)
        ]);
    }
    async quit() {
        this.removeAllListeners();
        this._isDestroyed = true;
        this._sub.unsubscribe(this._options.queueName);
        await Promise.all([this._client.quit(), this._sub.quit()]).catch(() => { });
    }
    async addRunningJob(id, lock) {
        await this._client.zadd(this._queueRunningSetKey, Date.now() + lock, id);
    }
    async removeRunningJob(id) {
        await this._client.zrem(this._queueRunningSetKey, id);
    }
    async countRunningJobs() {
        return this._client.zcount(this._queueRunningSetKey, Date.now(), "+inf");
    }
}
exports.Client = Client;
//# sourceMappingURL=client.js.map