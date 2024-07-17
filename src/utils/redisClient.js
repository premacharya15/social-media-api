import redis from 'redis';
const client = redis.createClient({
  host: 'localhost', // or your Redis server host
  port: 6379 // default Redis port
});

client.on('error', (err) => console.log('Redis Client Error', err));

client.connect();

export default client;