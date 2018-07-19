import redis = require("redis");
import fs = require("fs");
import path = require("path");
import Q = require("bluebird");
import _ = require("lodash");
import * as Scripto from "redis-scripto";
import {IOptions} from "./IOptions";
import {IJobParams} from "./IJob";
import {EventDispatcher} from "appolo-event-dispatcher";


export class Client extends EventDispatcher {

    private _client: redis.RedisClient;
    private _sub: redis.RedisClient;
    private scripto: Scripto;

    constructor(private _options: IOptions) {
        super();
    }

    private get _getQueueSet() {
        return `${this._options.queueName}_set_{1}`
    }

    private get _getQueueHash() {
        return `${this._options.queueName}_hash_{1}`
    }

    public connect(): Promise<void> {

        return new Promise(async (resolve, reject) => {

            let params = {no_ready_check: true, socket_keepalive: true};

            this._client = redis.createClient(this._options.redis, params);
            this._sub = redis.createClient(this._options.redis, params);

            this._sub.subscribe(this._options.queueName);

            this._sub.on("message", this._onMessage.bind(this));

            this._client.on('connect', () => {
                resolve();
            });

            this._client.on('error', (error) => {
                reject(error)
            });

            let scripto = this.scripto = new Scripto(this._client);

            let script = await Q.props({
                "get_jobs": Q.fromCallback(c => fs.readFile(path.resolve(__dirname, "lua/get_jobs.lua"), {encoding: "utf8"}, c)),
                "set_job": Q.fromCallback(c => fs.readFile(path.resolve(__dirname, "lua/set_job.lua"), {encoding: "utf8"}, c)),
                "del_job": Q.fromCallback(c => fs.readFile(path.resolve(__dirname, "lua/del_job.lua"), {encoding: "utf8"}, c))
            });

            scripto.load(script as any);
        })
    }

    private _onMessage(channel: string, message: string) {
        let data: { eventName: string, job: IJobParams } = JSON.parse(message);

        this.fireEvent(data.eventName, data.job);

    }

    public publish(eventName: string, data: IJobParams) {
        this._client.publish(this._options.queueName, JSON.stringify({eventName, job: data}));
    }

    public async getJobsByDate(date: number, limit: number, lock: number): Promise<IJobParams[]> {

        let results: string[] = await Q.fromCallback(c => this.scripto.run('get_jobs', [this._getQueueSet, this._getQueueHash], [date, limit, lock], c));

        if (!results || !results.length) {
            return [];
        }

        return _.map(results, item => JSON.parse(item));
    }

    public async removeJob(id: string): Promise<void> {

        await  Q.fromCallback(c => this.scripto.run('del_job', [this._getQueueSet, this._getQueueHash], [id], c));
    }

    public async getJob(id: string): Promise<IJobParams> {
        let data = await Q.fromCallback(c => this._client.hget(this._getQueueSet, id, c));

        if (!data) {
            return null;
        }

        let jobParams: IJobParams = JSON.parse(data);

        return jobParams
    }

    public async setJobTime(id: string, time: number): Promise<void> {

        await Q.fromCallback(c => this._client.zadd(this._getQueueSet, time, id, c));
    }

    public async setJob(job: IJobParams, nextRun: number): Promise<void> {


        await Q.fromCallback(c => this.scripto.run('set_job', [this._getQueueSet, this._getQueueHash], [nextRun, job.id, JSON.stringify(job)], c));
    }

    public async getAllJobs(): Promise<IJobParams[]> {
        let jobs = await Q.fromCallback(c => this._client.hvals(this._getQueueHash, c));

        return _.map(jobs, item => JSON.parse(item));
    }

    public async hasJob(id: string): Promise<boolean> {
        let bool = await Q.fromCallback(c => this._client.hexists(this._getQueueHash, id, c))

        return bool;
    }

    public async purge() {
        await Q.all([
            Q.fromCallback(c => this._client.del(this._getQueueHash, c)),
            Q.fromCallback(c => this._client.del(this._getQueueSet, c))
        ]);

    }

}