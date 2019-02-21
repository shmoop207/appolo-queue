import fs = require("fs");
import path = require("path");
import Q = require("bluebird");
import _ = require("lodash");
import util = require("util");
import Redis = require("ioredis");
import {IOptions} from "./IOptions";
import {IJobParams} from "./IJob";
import {EventDispatcher} from "appolo-event-dispatcher";
import {Events} from "./events";


export class Client extends EventDispatcher {

    private _client: Redis.Redis;
    private _sub: Redis.Redis;

    constructor(private _options: IOptions) {
        super();
    }

    private get _getQueueSet() {
        return `${this._options.queueName}_set_{1}`
    }

    private get _getQueueHash() {
        return `${this._options.queueName}_hash_{1}`
    }

    public async connect(): Promise<void> {


        let params = {enableReadyCheck: true, lazyConnect: true, keepAlive: 1000};

        this._client = new Redis(this._options.redis, params);
        this._sub = new Redis(this._options.redis, params);

        this._sub.subscribe(this._options.queueName);

        this._sub.on("message", this._onMessage.bind(this));

        let fsAsync = util.promisify(fs.readFile);

        let script = await Q.props({
            "get_jobs": fsAsync(path.resolve(__dirname, "lua/get_jobs.lua"), {encoding: "utf8"}),
            "set_job": fsAsync(path.resolve(__dirname, "lua/set_job.lua"), {encoding: "utf8"}),
            "del_job": fsAsync(path.resolve(__dirname, "lua/del_job.lua"), {encoding: "utf8"})
        });

        _.forEach(script, (value, key) => this._client.defineCommand(key, {numberOfKeys: 2, lua: value}));

    }

    private _onMessage(channel: string, message: string) {
        let data: { eventName: string, job: IJobParams } = JSON.parse(message);

        this.fireEvent(`${Events.ClientMessage}`, data);
        this.fireEvent(`${Events.ClientMessage}:${data.job.id}`, data);

    }

    public publish(eventName: string, job: IJobParams, result: any = null) {
        this._client.publish(this._options.queueName, JSON.stringify({eventName, job, result})).catch();
    }

    public async getJobsByDate(date: number, limit: number, lock: number): Promise<IJobParams[]> {

        let results: string[] = await this._client['get_jobs'](this._getQueueSet, this._getQueueHash, date, limit, lock);

        if (!results || !results.length) {
            return [];
        }

        return _.map(results, item => JSON.parse(item));
    }

    public async removeJob(id: string): Promise<void> {

        await this._client['del_job'](this._getQueueSet, this._getQueueHash, id);
    }

    public async getJob(id: string): Promise<IJobParams> {
        let data = await this._client.hget(this._getQueueHash, id);

        if (!data) {
            return null;
        }

        let jobParams: IJobParams = JSON.parse(data);

        return jobParams
    }

    public async setJobTime(id: string, time: number): Promise<void> {

        await this._client.zadd(this._getQueueSet, time.toString(), id);
    }

    public async setJob(job: IJobParams, nextRun: number): Promise<void> {


        await this._client['set_job'](this._getQueueSet, this._getQueueHash, nextRun, job.id, JSON.stringify(job));
    }

    public async getAllJobs(): Promise<IJobParams[]> {
        let jobs = await this._client.hvals(this._getQueueHash);

        return _.map(jobs, item => JSON.parse(item));
    }

    public async hasJob(id: string): Promise<boolean> {
        let bool = await this._client.hexists(this._getQueueHash, id);

        return !!bool;
    }

    public async purge() {
        await Q.all([
            this._client.del(this._getQueueHash),
            this._client.del(this._getQueueSet)
        ]);

    }

    public async quit() {
        await Q.all([this._client.quit(), this._sub.quit()]);

    }

}