/**
 * RAG (Retrieval-Augmented Generation) Type Definitions
 * 
 * Defines the structure for Vietnamese legal documents processing
 * with dynamic chunking based on document hierarchy
 */

// ============================================
// Document Metadata Structures
// ============================================

export interface DocumentMetadata {
  documentNumber?: string;      // Số văn bản (e.g., "01/2024/TT-NHNN")
  documentName: string;          // Tên văn bản
  documentType?: string;         // Loại văn bản (Thông tư, Nghị định, Quyết định, etc.)
  issuingAgency?: string;        // Cơ quan ban hành
  signer?: {
    name?: string;               // Tên người ký
    title?: string;              // Chức danh người ký
  };
  signedDate?: string;           // Ngày ký (ISO format)
}

export interface BasisItem {
  type: string;                  // Type of basis (Luật, Nghị định, etc.)
  number?: string;               // Number/code
  name: string;                  // Full name
  date?: string;                 // Date if applicable
}

// ============================================
// Content Structure (Hierarchical)
// ============================================

export interface DocumentContent {
  overview: DocumentMetadata;
  basis?: BasisItem[];           // Căn cứ pháp lý
  chapters?: Chapter[];          // Các chương (if document has chapters)
  articles?: Article[];          // Các điều (for documents without chapters)
  appendices?: Appendix[];       // Phụ lục (if any)
}

export interface Chapter {
  number: string;                // Chapter number (e.g., "I", "II", "1", "2")
  title: string;                 // Chapter title
  articles: Article[];           // Articles within this chapter
}

export interface Article {
  number: string;                // Article number (e.g., "1", "2", "15")
  title?: string;                // Article title (optional)
  content?: string;              // Direct article content (if no sections)
  sections?: Section[];          // Sections/clauses within article
}

export interface Section {
  number?: string;               // Section/clause number (e.g., "1", "2", "a", "b")
  content: string;               // Section content
  subsections?: Subsection[];    // Deeper nested items (ý, điểm)
}

export interface Subsection {
  identifier?: string;           // Identifier (a, b, c, -, etc.)
  content: string;               // Subsection content
}

export interface Appendix {
  number?: string;               // Appendix number
  title: string;                 // Appendix title
  content: string;               // Appendix content (can be tables, etc.)
}

// ============================================
// Chunk Strategy
// ============================================

export type ChunkType =
  | 'overview'    // Document metadata and overview
  | 'basis'       // Legal basis section
  | 'chapter'     // Full chapter (if short)
  | 'article'     // Individual article (primary chunk unit)
  | 'section'     // Large article broken into sections
  | 'appendix';   // Appendix content

export interface ChunkMetadata {
  documentId: string;
  documentNumber?: string;
  documentName: string;
  documentType?: string;

  // Hierarchical position
  chapterNumber?: string;
  chapterTitle?: string;
  articleNumber?: string;
  articleTitle?: string;
  sectionNumber?: string;

  // Chunk info
  chunkType: ChunkType;
  chunkIndex: number;
}

export interface DocumentChunkData {
  content: string;               // Markdown formatted content
  metadata: ChunkMetadata;
  embedding?: number[];          // Vector embedding (768 dimensions)
}

// ============================================
// Processing Status
// ============================================

export type ProcessingStatus = 'processing' | 'completed' | 'failed';
export type EmbeddingStatus = 'pending' | 'completed' | 'failed';

export interface ProcessingProgress {
  documentId: string;
  status: ProcessingStatus;
  progress: number;              // 0-100
  currentStep: string;           // Description of current step
  error?: string;
  chunksCreated?: number;
  chunksEmbedded?: number;
}

// ============================================
// Qdrant Vector Database
// ============================================

export interface QdrantPoint {
  id: string;                    // Unique point ID (chunkId)
  vector: number[];              // Embedding vector (768 dimensions)
  payload: {
    documentId: string;
    documentNumber?: string;
    documentName: string;
    documentType?: string;
    chunkType: ChunkType;
    chunkIndex: number;

    // Hierarchical info
    chapterNumber?: string;
    chapterTitle?: string;
    articleNumber?: string;
    articleTitle?: string;
    sectionNumber?: string;

    // Content
    content: string;             // Full markdown content
    contentPreview: string;      // First 200 chars for display
  };
}

export interface QdrantSearchResult {
  id: string;
  score: number;                 // Similarity score (0-1)
  payload: QdrantPoint['payload'];
}

// ============================================
// RAG Query & Response
// ============================================

export interface RAGQuery {
  question: string;
  documentIds?: string[];        // Optional: filter by specific documents
  topK?: number;                 // Number of chunks to retrieve (default: 5)
  minScore?: number;             // Minimum similarity score (default: 0.5)
}

export interface RAGResponse {
  answer: string | any;           // Generated answer (can be string or structured object)
  sources: RetrievedChunk[];     // Source chunks used
  model: string;                 // Model used for generation
  confidence: number;            // Overall confidence score
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
  structured?: boolean;          // Whether answer is structured (quiz format)
  citations?: Array<{            // Detailed citation mapping (File Search specific)
    segment: any;                // Text segment from answer
    chunkIndices: number[];      // Which source chunks were used
    confidenceScores?: number[]; // Confidence for each chunk
  }>;
}

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  documentName: string;
  documentNumber?: string;
  score: number;
  content: string;
  metadata: ChunkMetadata;
}

// ============================================
// API Request/Response Types
// ============================================

export interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination?: string;
  filename?: string;
  path?: string;
  buffer?: Buffer;
}

export interface UploadDocumentsRequest {
  files: UploadedFile[];
  userId: string;                // Admin user ID
}

export interface UploadDocumentsResponse {
  success: boolean;
  documents: {
    id: string;
    fileName: string;
    status: ProcessingStatus;
  }[];
  errors?: {
    fileName: string;
    error: string;
  }[];
}

export interface ListDocumentsResponse {
  documents: {
    id: string;
    fileName: string;
    documentName: string;
    documentNumber?: string;
    documentType?: string;
    uploadedAt: string;
    processingStatus: ProcessingStatus;
    chunksCount: number;
  }[];
  total: number;
}

export interface DocumentDetailResponse {
  id: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  uploadedBy: string;

  // Metadata
  documentNumber?: string;
  documentName: string;
  documentType?: string;
  issuingAgency?: string;
  signerName?: string;
  signerTitle?: string;
  signedDate?: string;

  // Content
  markdownContent: string;

  // Processing
  processingStatus: ProcessingStatus;
  errorMessage?: string;

  // Chunks
  chunks: {
    id: string;
    chunkType: ChunkType;
    chunkIndex: number;
    content: string;
    metadata: ChunkMetadata;
    embeddingStatus: EmbeddingStatus;
  }[];
}

// ============================================
// Gemini API Response Types
// ============================================

export interface GeminiExtractionResponse {
  content: DocumentContent;
  rawText?: string;              // Full extracted text
}

export interface GeminiEmbeddingResponse {
  embedding: number[];           // 768-dimensional vector
}
