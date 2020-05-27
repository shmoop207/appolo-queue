local score = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local lock = tonumber(ARGV[3])
local queueSet = KEYS[1]
local queueHash = KEYS[2]
local queueSetRunning = KEYS[3]

local results = redis.call('ZRANGEBYSCORE', queueSet, 0, score, "LIMIT", 0, limit)

local output = {}

for _, id in ipairs(results) do
    redis.call('ZADD', queueSet, lock, id);
    redis.call('ZADD', queueSetRunning, lock, id);

    local item = redis.call('HGET', queueHash, id);

    table.insert(output, item)
end

return output
