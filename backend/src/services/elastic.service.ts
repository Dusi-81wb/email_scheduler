import { Client } from '@elastic/elasticsearch';
import { prisma } from '../config/db';
import dotenv from 'dotenv';

dotenv.config();

const ELASTIC_NODE = process.env.ELASTICSEARCH_NODE || 'http://localhost:9200';
const INDEX_NAME = 'emails';

export interface EmailDocument {
  id: string;
  scheduleId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: string;
  sentAt?: string | null;
  etherealUrl?: string | null;
}

class ElasticService {
  private client: Client | null = null;
  private isConnected: boolean = false;
  private lastCheckTime: number = 0;

  constructor() {
    this.initClient();
  }

  private initClient() {
    try {
      this.client = new Client({
        node: ELASTIC_NODE,
        maxRetries: 1,
        requestTimeout: 1000,
      });
      this.verifyConnection();
    } catch (e: any) {
      console.warn('⚠️ Elasticsearch initialization warning:', e.message);
    }
  }

  public async verifyConnection(): Promise<boolean> {
    if (!this.client) return false;
    const now = Date.now();
    // Only attempt ping once every 30 seconds if offline
    if (!this.isConnected && now - this.lastCheckTime < 30000) {
      return false;
    }
    this.lastCheckTime = now;

    try {
      await this.client.ping();
      this.isConnected = true;
      console.log(`✅ Connected to Elasticsearch at ${ELASTIC_NODE}`);
      await this.ensureIndexExists();
      return true;
    } catch (e) {
      this.isConnected = false;
      return false;
    }
  }

  private async ensureIndexExists() {
    if (!this.client || !this.isConnected) return;
    try {
      const exists = await this.client.indices.exists({ index: INDEX_NAME });
      if (!exists) {
        await this.client.indices.create({
          index: INDEX_NAME,
          body: {
            mappings: {
              properties: {
                id: { type: 'keyword' },
                scheduleId: { type: 'keyword' },
                senderEmail: { type: 'text', fields: { keyword: { type: 'keyword' } } },
                recipientEmail: { type: 'text', fields: { keyword: { type: 'keyword' } } },
                subject: { type: 'text' },
                body: { type: 'text' },
                status: { type: 'keyword' },
                scheduledAt: { type: 'date' },
                sentAt: { type: 'date' },
                etherealUrl: { type: 'keyword' },
              },
            },
          },
        });
        console.log(`✅ Elasticsearch index '${INDEX_NAME}' created`);
      }
    } catch (e: any) {
      console.warn('⚠️ Error creating Elasticsearch index:', e.message);
    }
  }

  /**
   * Index or update an EmailJob into Elasticsearch.
   */
  public async indexEmail(doc: EmailDocument): Promise<void> {
    if (!this.client || !this.isConnected) {
      await this.verifyConnection();
      if (!this.isConnected) return; // Will fall back to PostgreSQL
    }

    try {
      await this.client!.index({
        index: INDEX_NAME,
        id: doc.id,
        document: doc,
        refresh: true,
      });
    } catch (e: any) {
      console.warn(`⚠️ Failed to index email ${doc.id} in Elasticsearch:`, e.message);
    }
  }

  /**
   * Searches emails via Elasticsearch with automatic fallback to PostgreSQL.
   */
  public async searchEmails(query: string, status?: string, page = 1, limit = 20) {
    // If Elasticsearch is reachable, query Elasticsearch
    if (this.client && this.isConnected) {
      try {
        const mustClauses: any[] = [];

        if (query && query.trim()) {
          mustClauses.push({
            multi_match: {
              query,
              fields: ['subject^3', 'body', 'recipientEmail^2', 'senderEmail^2'],
              fuzziness: 'AUTO',
            },
          });
        }

        if (status) {
          mustClauses.push({
            term: { status: status.toUpperCase() },
          });
        }

        const esRes = await this.client.search({
          index: INDEX_NAME,
          from: (page - 1) * limit,
          size: limit,
          query: mustClauses.length > 0 ? { bool: { must: mustClauses } } : { match_all: {} },
          sort: [{ scheduledAt: { order: 'desc' } }],
        });

        const hits = esRes.hits.hits;
        const total = typeof esRes.hits.total === 'number' ? esRes.hits.total : (esRes.hits.total?.value || 0);

        const jobs = hits.map((hit) => hit._source as EmailDocument);
        return { jobs, total, source: 'elasticsearch' };
      } catch (e: any) {
        console.warn('⚠️ Elasticsearch search error, falling back to PostgreSQL:', e.message);
      }
    }

    // Transparent Fallback to PostgreSQL search
    console.log(`🔍 Using PostgreSQL fallback search for query: "${query}"`);
    const where: any = {};
    if (status) {
      where.status = status.toUpperCase();
    }

    if (query && query.trim()) {
      where.OR = [
        { subject: { contains: query, mode: 'insensitive' } },
        { body: { contains: query, mode: 'insensitive' } },
        { recipientEmail: { contains: query, mode: 'insensitive' } },
        { senderEmail: { contains: query, mode: 'insensitive' } },
      ];
    }

    const [jobs, total] = await Promise.all([
      prisma.emailJob.findMany({
        where,
        orderBy: { scheduledAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.emailJob.count({ where }),
    ]);

    return { jobs, total, source: 'database' };
  }
}

export const elasticService = new ElasticService();
