import redis from 'redis';

const client = redis.createClient({
  host: process.env.REDIS_HOST, // or your Redis server host
  port: process.env.REDIS_PORT // default Redis port
});

let isConnected = false;

client.on('connect', () => {
  isConnected = true;
  // console.log('Redis Client Connected');
});

client.on('error', (err) => {
  isConnected = false;
  // console.error('Redis Client Error', err);
});

client.connect();

// Function to check Redis connection
export const isRedisConnected = async () => {
  return isConnected;
};

export default client;