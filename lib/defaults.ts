import {IHandlerOptions, IJobOptions, IOptions} from "./IOptions";

export let QueueDefaults = <Partial<IOptions>>{
    checkInterval: 1000,
    lockTime: 1000 * 60,
    queueName: 'appolo-queue',
    maxConcurrency: 1,
    autoStart:true


};

export let JobDefaults = <Partial<IJobOptions>>{
    retry: 10,
    repeat: 1,
    schedule: 0,
    lockTime: 60 * 1000,
    backoff: 1000,
};

export let HandlerDefaults = <Partial<IHandlerOptions>>{
    lockTime: 0
};