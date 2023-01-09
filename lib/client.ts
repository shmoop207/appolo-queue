import fs = require("fs");
import path = require("path");
import util = require("util");
import {default as Redis,RedisOptions} from 'ioredis'
import {IOptions} from "./IOptions";
import {IJobParams} from "./IJob";
import {EventDispatcher} from "@appolo/events";
import {Events} from "./events";


export class Client extends EventDispatcher {

    private _client: Redis;
    private _sub: Redis;
    private _isDestroyed = false;

    constructor(private _options: IOptions) {
        super();
    }

    private get _queueSetKey() {
        return `${this._options.queueName}_set_{1}`
    }

    private get _queueRunningSetKey() {
        return `${this._options.queueName}_set_running_{1}`
    }

    private get _queueHashKey() {
        return `${this._options.queueName}_hash_{1}`
    }

    public async connect(): Promise<void> {


        let params:RedisOptions = {enableReadyCheck: true, lazyConnect: true, keepAlive: 1000} as any;

        let conn = new URL(this._options.redis);
        if (conn.protocol == "rediss:") {
            (params as any).tls = true;
        }

        params.host = conn.hostname;
        params.port = parseInt(conn.port);
        params.password = conn.password;


        this._client = new Redis(this._options.redis, params);
        this._sub = new Redis(this._options.redis, params);

        await Promise.all([this._client.connect(), this._sub.connect()]);

        this._sub.subscribe(this._options.queueName);

        this._sub.on("message", this._onMessage.bind(this));


        let fsAsync = util.promisify(fs.readFile);

        let scriptNames = ["get_jobs", "set_job", "del_job"]

        let scripts = await Promise.all([
            fsAsync(path.resolve(__dirname, "lua/get_jobs.lua"), {encoding: "utf8"}),
            fsAsync(path.resolve(__dirname, "lua/set_job.lua"), {encoding: "utf8"}),
            fsAsync(path.resolve(__dirname, "lua/del_job.lua"), {encoding: "utf8"})]);

        scripts.forEach((value, index) => this._client.defineCommand(scriptNames[index], {
            numberOfKeys: 3,
            lua: value
        }));

    }

    private _onMessage(channel: string, message: string) {
        if (this._isDestroyed) {
            return
        }
        let data: { eventName: string, job: IJobParams } = JSON.parse(message);

        this.fireEvent(`${Events.ClientMessage}`, data);
        this.fireEvent(`${Events.ClientMessage}:${data.job.id}`, data);

    }

    public publish(eventName: string, job: IJobParams, result: any = null) {
        if (this._isDestroyed) {
            return
        }

        this._client.publish(this._options.queueName, JSON.stringify({eventName, job, result})).catch();
    }

    public async getJobsByDate(date: number, limit: number, lock: number): Promise<IJobParams[]> {

        let results: string[] = await this._client['get_jobs'](this._queueSetKey, this._queueHashKey, this._queueRunningSetKey, date, limit, Date.now()+lock);

        if (!results || !results.length) {
            return [];
        }

        return results.map(item => JSON.parse(item));
    }

    public async removeJob(id: string): Promise<void> {

        await this._client['del_job'](this._queueSetKey, this._queueHashKey, this._queueRunningSetKey, id);
    }

    public async getJob(id: string): Promise<IJobParams> {
        let data = await this._client.hget(this._queueHashKey, id);

        if (!data) {
            return null;
        }

        let jobParams: IJobParams = JSON.parse(data);

        return jobParams
    }

    public async setJobTime(id: string, time: number): Promise<void> {

        await this._client.zadd(this._queueSetKey, time.toString(), id);
    }

    public async setJob(job: IJobParams, nextRun: number): Promise<void> {


        await this._client['set_job'](this._queueSetKey, this._queueHashKey, this._queueRunningSetKey, nextRun, job.id, JSON.stringify(job));
    }

    public async getAllJobs(): Promise<IJobParams[]> {
        let jobs = await this._client.hvals(this._queueHashKey);

        return (jobs || []).map(item => JSON.parse(item));
    }

    public async hasJob(id: string): Promise<boolean> {
        let bool = await this._client.hexists(this._queueHashKey, id);

        return !!bool;
    }

    public async purge() {
        await Promise.all([
            this._client.del(this._queueHashKey),
            this._client.del(this._queueSetKey),
            this._client.del(this._queueRunningSetKey)
        ]);

    }

    public async quit() {
        this.removeAllListeners();
        this._isDestroyed = true;
        this._sub.unsubscribe(this._options.queueName);

        await Promise.all([this._client.quit(), this._sub.quit()]).catch(()=>{});

    }

    public async addRunningJob(id: string, lock: number) {
        await this._client.zadd(this._queueRunningSetKey, Date.now() + lock, id)
    }

    public async removeRunningJob(id: string) {
        await this._client.zrem(this._queueRunningSetKey, id)
    }

    public async countRunningJobs(): Promise<number> {
        return this._client.zcount(this._queueRunningSetKey, Date.now(), "+inf")
    }

}
