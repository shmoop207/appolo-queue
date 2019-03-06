import {IJobOptions} from "./IOptions";
import {Job} from "./job";

export interface IJobParams {
    id: string,
    params: { [index: string]: any },
    options?: IJobOptions,
    data?: IJobData
}

export interface IJobData {
    lastRun: number;
    status: "success" | "error"
    runCount: number;
    errorCount: number;
    nextRun: number
}

export type JobHandler = (job: Job) => Promise<any>