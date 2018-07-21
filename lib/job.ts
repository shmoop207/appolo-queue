import {IJobOptions, ScheduleType} from "./IOptions";
import {Util} from "./util";
import {IJobData, IJobParams} from "./IJob";
import {Client} from "./client";
import {JobDefaults} from "./defaults";
import {Events} from "./events";
import {EventDispatcher} from "appolo-event-dispatcher/index";
import _ = require("lodash");

export class Job extends EventDispatcher {

    private _id: string;
    private _options: IJobOptions;
    private _params: { [index: string]: any } = {};
    private _data: IJobData;
    private _client: Client;
    private _isNew: boolean;


    constructor(id: string, options: IJobOptions, client: Client, params?: { [index: string]: any }, data?: IJobData) {

        super();

        this._id = id;
        this._isNew = !data;
        this._options = _.defaults({}, options, JobDefaults);
        this._params = params || {};
        this._data = data || {lastRun: 0, runCount: 0, errorCount: 0, nextRun: Date.now()};
        this._client = client;


        this._bindEvents()

    }

    public repeat(value: number): this {
        this._options.repeat = value;
        return this;
    }

    public retry(value: number): this {
        this._options.retry = value;
        return this;
    }

    public backoff(value: number): this {
        this._options.backoff = value;
        return this;
    }

    public handler(value: string): this {
        this._options.handler = value;
        return this;
    }

    public delay(value: ScheduleType): this {
        this.repeat(1);

        this._setSchedule(value);

        return this;
    }

    public schedule(schedule: ScheduleType): this {

        this.repeat(null);

        this._setSchedule(schedule);

        return this;
    }

    private _setSchedule(schedule: ScheduleType) {

        this._options.schedule = schedule;
        this._data.nextRun = Util.calcNextRun(this._options.schedule)

    }

    public lockTime(lockTime: number): this {
        this._options.lockTime = lockTime;

        return this;
    }

    private _bindEvents() {
        this._client.on(`${Events.ClientMessage}:${this.id}`, this._onClientMessage, this);
    }

    private _onClientMessage(data: { eventName: string, job: IJobParams, result: any }) {

        this.fireEvent(data.eventName, this, data.result);
    }

    public on(event: Events.JobComplete | Events.JobSuccess | Events.JobFail  | Events.JobStart, fn: (...args: any[]) => any, scope?: any) {
        return super.on(event, fn, scope)
    }

    public once(event: Events.JobComplete | Events.JobSuccess | Events.JobFail  | Events.JobStart, fn: (...args: any[]) => any, scope?: any) {
        return super.once(event, fn, scope)
    }

    public un(event: Events.JobComplete | Events.JobSuccess | Events.JobFail  | Events.JobStart, fn: (...args: any[]) => any, scope?: any) {
        return super.un(event, fn, scope)
    }

    public get id():string {
        return this._id;
    }

    public get params():{[index:string]:any} {
        return this._params;
    }

    public get nextRun(): number {

        return this._data.nextRun;
    }

    public set nextRun(value: number) {
        this._data.nextRun = value;
    }

    public interval(): number {
        return Util.calcInterval(this._options.schedule)
    }

    public get options(): IJobOptions {
        return this._options;
    }

    public get data(): IJobData {
        return this._data;
    }

    public async lock(time?: number): Promise<this> {
        time = time || this._options.lockTime;

        this._data.nextRun = Date.now() + time;

        await this.exec();

        return this;
    }

    public async run(waitForResult: boolean = false): Promise<this | any> {

        if (waitForResult) {
            return this._runWithResult();
        }

        this._data.nextRun = Date.now();

        await this.exec();

        return this;
    }

    private _runWithResult(): Promise<any> {
        return new Promise(async (resolve, reject) => {
            this.once(Events.JobSuccess, (job: IJobParams, result) => resolve(result))
            this.once(Events.JobFail, (job: IJobParams, result) => reject(result))
            await this.run();
        })
    }

    public cancel(): Promise<void> {
        this._client.un(`${Events.ClientMessage}:${this.id}`, this._onClientMessage, this);

        return this._client.removeJob(this._id);

    }

    public async exec(): Promise<this> {

        await this._checkNextTime();

        await this._client.setJob(this.toJobParam(), this._data.nextRun);

        return this;
    }

    private async _checkNextTime() {
        if (this._isNew) {
            let dbJob = await  this._client.getJob(this.id);

            if (dbJob && dbJob.options.schedule == this._options.schedule) {
                this._data.nextRun = dbJob.data.nextRun
            }
        }

        if (this._data.nextRun - Date.now() < 0) {
            this._data.nextRun = Date.now();
        }
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