export interface IOptions {
    redis: string
    queueName?: string
    checkInterval?: number
    maxConcurrency?: number
    lockTime?: number
    autoStart?: boolean;
    autoAck?: boolean;

}

export type ScheduleType = string | number | Date;

export interface IJobOptions {
    lockTime?: number
    schedule?: ScheduleType,
    backoff?: number
    retry?: number
    repeat?: number
    override?: boolean
    handler?: string
}

export interface IHandlerOptions {
    lockTime?: number
}
