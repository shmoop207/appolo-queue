"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Q = require("bluebird");
class LuaMock {
    constructor(_client) {
        this._client = _client;
    }
    load() {
    }
    async run(scriptName, keys, args, callback) {
        switch (scriptName) {
            case "set_job":
                await Q.all([Q.fromCallback(c => this._client.ZADD(keys[0], args[0], args[1], c)), Q.fromCallback(c => this._client.HSET(keys[1], args[1], args[2], c))]);
                callback();
                break;
            case "get_jobs":
                let data = await Q.fromCallback(c => this._client.ZRANGEBYSCORE(keys[0], 0, args[0], "", "LIMIT", 0, args[1], c));
                let result = await Q.map(data, async (id) => {
                    await Q.fromCallback(c => this._client.ZINCRBY(args[0], args[2], id, c));
                    return Q.fromCallback(c => this._client.HGET(keys[1], id, c));
                });
                callback(null, result);
                break;
            case "del_job":
                await Q.all([Q.fromCallback(c => this._client.ZREM(keys[0], args[0], c)), Q.fromCallback(c => this._client.HDEL(keys[1], args[0], c))]);
                callback();
                break;
        }
    }
}
exports.LuaMock = LuaMock;
//# sourceMappingURL=luaMock.js.map