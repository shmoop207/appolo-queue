import {IJobOptions} from "./IOptions";
import {Util} from "./util";
import {IJobData, IJobParams} from "./IJob";
import {Client} from "./client";
import {JobDefaults} from "./defaults";
import _ = require("lodash");

export class Job {

    private _id: string;
    private _options: IJobOptions;
    private _params: { [index: string]: any } = {};
    private _data: IJobData;
    private _client: Client;


    constructor(id: string, options: IJobOptions, client: Client, params?: { [index: string]: any }, data?: IJobData) {
        this._id = id;
        this._options = _.defaults({}, options, JobDefaults);
        this._params = params || {};
        this._data = data || {lastRun: 0, runCount: 0, errorCount: 0};
        this._client = client;


    }

    public get id() {
        return this._id;
    }

    public get params() {
        return this._params;
    }

    public get nextRun(): number {

        return Util.calcNextRun(this._options.schedule)
    }

    public interval(): number {
        return this.nextRun - Date.now();
    }

    public async lock(time?: number): Promise<void> {
        time = time || this._options.lockLifetime;

        if (time) {
            await this._client.setJobTime(this._id, Date.now() + time);
        }
    }

    public run(): Promise<void> {
        return this._client.setJobTime(this._id, Date.now());
    }

    public runEvery(schedule: string | number) {
        this._options.schedule = schedule;
        this._options.repeat = this._options.repeat || 0;

        return this.save();
    }

    public runOnce(time: string | number) {
        this._options.schedule = time;
        this._options.repeat = this._options.repeat || 1;

        return this.save();
    }

    public runNow() {
        return this.runOnce(0);
    }

    public cancel(): Promise<void> {
        return this._client.removeJob(this._id)
    }

    public async ack(): Promise<void> {
        this._data.lastRun = Date.now();
        this._options.repeat && (this._data.runCount++);
        this._data.errorCount = 0;

        if (this._options.repeat && this._data.runCount >= this._options.repeat) {

            await this.cancel();

        } else {
            await this.save();
        }
    }

    public async nack(): Promise<void> {

        try {
            this._data.errorCount++;

            let nextRun = (this._data.errorCount <= this._options.retry)
                ? Date.now() + (this._data.errorCount * 1000)
                : this.nextRun;

            await this._save(nextRun);

        } catch (e) {

        }

    }

    private async _save(nextRun?: number) {
        nextRun = nextRun || this.nextRun;

        if (nextRun - Date.now() < 0) {
            throw new Error(`job next run date is in the past for jobId ${this.id}`)
        }

        await this._client.setJob(this.toJobParam(), nextRun);
    }

    public save(): Promise<void> {
        return this._save();
    }

    public toJobParam(): IJobParams {
        return {
            id: this._id,
            params: this._params,
            options: this._options,
            data: this._data,
        }
    }


}