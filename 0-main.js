import redisClient from './utils/redis';

// js c

(async () => {
  console.log(redisClient.isAlive());
  console.log(await redisClient.get('myKey7'));
  await redisClient.set('myKey7', 12, 5);
  console.log(await redisClient.get('myKey7'));

  setTimeout(async () => {
    console.log(await redisClient.get('myKey7'));
  }, 1000 * 10);
})();
