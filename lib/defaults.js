"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueDefaults = {
    checkInterval: 1000,
    lockTime: 1000 * 60,
    queueName: 'appolo-queue',
    maxConcurrency: 1
};
exports.JobDefaults = {
    retry: 10,
    repeat: 1,
    schedule: 0,
    lockTime: 60 * 1000,
    backoff: 1000,
};
exports.HandlerDefaults = {
    lockTime: 0
};
//# sourceMappingURL=defaults.js.map