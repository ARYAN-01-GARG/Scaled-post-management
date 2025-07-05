import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: RedisClientType;
  private subscriber: RedisClientType;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const redisConfig = {
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD'),
    };

    this.client = createClient({
      url: `redis://${redisConfig.host}:${redisConfig.port}`,
    });
    
    this.subscriber = createClient({
      url: `redis://${redisConfig.host}:${redisConfig.port}`,
    });

    await this.client.connect();
    await this.subscriber.connect();

    this.client.on('error', (err) => console.error('Redis Client Error', err));
    this.subscriber.on('error', (err) =>
      console.error('Redis Subscriber Error', err),
    );
  }

  async onModuleDestroy() {
    if (this.client) await this.client.quit();
    if (this.subscriber) await this.subscriber.quit();
  }

  getClient(): RedisClientType {
    return this.client;
  }

  getSubscriber(): RedisClientType {
    return this.subscriber;
  }

  async set(key: string, value: string, ttl?: number) {
    if (ttl) {
      return this.client.setEx(key, ttl, value);
    }
    return this.client.set(key, value);
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async del(key: string): Promise<number> {
    return this.client.del(key);
  }

  async publish(channel: string, message: string): Promise<number> {
    return this.client.publish(channel, message);
  }

  async subscribe(
    channel: string,
    callback: (message: string) => void,
  ): Promise<void> {
    await this.subscriber.subscribe(channel, callback);
  }

  async unsubscribe(channel: string): Promise<void> {
    await this.subscriber.unsubscribe(channel);
  }
}
