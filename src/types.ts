export interface DocumentRecord {
  id: string;
  filename: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  status: 'pending' | 'indexed' | 'failed';
  chunksCount: number;
  snippet?: string;
}

export interface ChunkRecord {
  id: string;
  fileId: string;
  pageContent: string;
  chunkIndex: number;
  metadata?: Record<string, any>;
  score?: number;
}

export interface SearchResult {
  text: string;
  score: number;
  fileId?: string;
  chunkId?: string;
}

export interface WebSearchResult {
  title?: string;
  content: string;
  url?: string;
  score?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  sourceType?: 'local_records' | 'web_research' | 'hybrid' | 'insufficient_data';
  retrievedChunks?: SearchResult[];
  webResults?: WebSearchResult[];
  thoughtSteps?: string[];
  executionTimeMs?: number;
}

export interface MetricsData {
  totalQueries: number;
  totalDocuments: number;
  totalChunks: number;
  avgLatencyMs: number;
  localSearchCount: number;
  webFallbackCount: number;
  recallAt1?: number;
  recallAt3?: number;
  recallAt5: number;
  recallAt10?: number;
  uptimeSeconds: number;
}

export enum ProcessSignal {
  FILE_VALIDATED_SUCCESS = 'file_validate_successfully',
  FILE_TYPE_NOT_SUPPORTED = 'file_type_not_supported',
  FILE_SIZE_EXCEEDED = 'file_size_exceeded',
  FILE_UPLOAD_SUCCESS = 'file_upload_success',
  FILE_UPLOAD_FAILED = 'file_upload_failed',
  FILE_RECORD_CREATE_FAILED = 'file_record_create_failed',
  PARSE_FAILED = 'parse_failed',
  NO_CHUNKS_PRODUCED = 'no_chunks_produced',
  CHUNKS_INSERT_FAILED = 'chunks_insert_failed',
  PROCESS_SUCCESS = 'process_success'
}
