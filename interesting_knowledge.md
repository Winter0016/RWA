# Interesting Web3 & Systems Knowledge

## Caching vs. Authentication (Why Redis Exists)

Imagine you run Twitter. A celebrity tweets something, and 1,000,000 people refresh their phones at the exact same second to see the tweet. If your Node.js backend asks the PostgreSQL database for that tweet 1,000,000 times, the database's hard drive will overheat and the entire website will crash. 

Instead, the backend asks PostgreSQL for the tweet **exactly once**. It then saves a copy of that tweet in **Redis**. Redis is a special database that stores everything in RAM (Computer Memory) instead of on a hard drive. RAM is lightning fast. So when the next 999,999 people ask for the tweet, Redis instantly hands them the cached copy in a fraction of a millisecond. 

### Why we DON'T use Redis for `addUser` (Authentication)
While caching is amazing for things like Tweets, YouTube videos, or Leaderboards (things everyone looks at together), it is **useless for Authentication.**

When 1,000 people log into your app, they aren't asking for the same answer. 
*   Alice is asking: *"Does wallet 0xAAA exist?"*
*   Bob is asking: *"Does wallet 0xBBB exist?"*

You can't give Bob the answer you saved for Alice. Every single person logging in is unique. Because the data is unique and highly sensitive, we *must* query PostgreSQL every single time. And thankfully, because we use a **Database Index**, PostgreSQL can easily handle thousands of unique authentication queries per second without breaking a sweat!
