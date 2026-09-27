import { Kafka, Producer, Consumer, Partitioners } from 'kafkajs';
import { ClickEvent } from '../types/index.js';

export const KAFKA_TOPICS = {
  URL_CLICKS: 'url-clicks',
};

let kafka: Kafka | null = null;
let producer: Producer | null = null;

export function getKafkaInstance(): Kafka {
  if (!kafka) {
    const brokers = (process.env.KAFKA_BROKERS || 'kafka:9092').split(',');
    const clientId = process.env.KAFKA_CLIENT_ID || 'tinyurl-service';
    kafka = new Kafka({
      clientId,
      brokers,
      retry: {
        initialRetryTime: 300,
        retries: 8,
      },
    });
  }
  return kafka;
}

export async function getKafkaProducer(): Promise<Producer> {
  if (!producer) {
    const k = getKafkaInstance();
    producer = k.producer({
      createPartitioner: Partitioners.DefaultPartitioner,
    });
    await producer.connect();
  }
  return producer;
}

export async function publishClickEvent(event: ClickEvent): Promise<void> {
  try {
    const prod = await getKafkaProducer();
    await prod.send({
      topic: KAFKA_TOPICS.URL_CLICKS,
      messages: [
        {
          key: event.shortCode, // Partition key ensures same shortCode events go to same partition
          value: JSON.stringify(event),
        },
      ],
    });
  } catch (err) {
    console.error('Failed to publish click event to Kafka:', err);
  }
}

export function createKafkaConsumer(groupId: string): Consumer {
  const k = getKafkaInstance();
  return k.consumer({ groupId });
}

let cachedKafkaHealth: { status: 'UP' | 'DOWN'; error?: string; timestamp: number } | null = null;
const KAFKA_HEALTH_CACHE_TTL_MS = 15000;

export async function checkKafkaHealth(): Promise<{ status: 'UP' | 'DOWN'; error?: string }> {
  const now = Date.now();
  if (cachedKafkaHealth && now - cachedKafkaHealth.timestamp < KAFKA_HEALTH_CACHE_TTL_MS) {
    return { status: cachedKafkaHealth.status, error: cachedKafkaHealth.error };
  }

  try {
    const k = getKafkaInstance();
    const admin = k.admin();
    await admin.connect();
    await admin.listTopics();
    await admin.disconnect();
    cachedKafkaHealth = { status: 'UP', timestamp: now };
    return { status: 'UP' };
  } catch (err: any) {
    cachedKafkaHealth = { status: 'DOWN', error: err.message, timestamp: now };
    return { status: 'DOWN', error: err.message };
  }
}
