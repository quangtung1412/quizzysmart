# RAG Response Format Conditional Logic

## Overview
Implemented conditional response formatting for RAG answers based on context (camera search vs chat) and question type (multiple choice vs open-ended).

## Changes Made

### 1. **Updated RAG Types** (`server/src/types/rag.types.ts`)
- Added `format?: 'json' | 'prose'` to `RAGQuery` interface
- Allows callers to specify desired response format
- Default: `'prose'` for natural language responses

### 2. **Updated RAG Service** (`server/src/services/gemini-rag.service.ts`)

#### `buildRAGPrompt()` Method
```typescript
private buildRAGPrompt(question: string, context: string, format: 'json' | 'prose' = 'prose'): string
```
- Added `format` parameter with default value `'prose'`
- Only uses JSON format when BOTH conditions are met:
  1. `format === 'json'` (explicitly requested)
  2. `isMultipleChoiceQuestion(question) === true` (has A/B/C/D options)
- Otherwise, uses prose format with citation markers [🔗n]

#### Updated Call Sites
- `generateRAGAnswer()`: Passes `query.format || 'prose'` to buildRAGPrompt
- `generateRAGAnswerStream()`: Passes `query.format || 'prose'` to buildRAGPrompt

### 3. **Updated Camera Search** (`server/src/index.ts`)

#### Non-Streaming Camera Search (line ~3491)
```typescript
const hasOptions = !!(extractedData.optionA && extractedData.optionB);

const ragQuery = {
  question: `...`,
  topK: ragSearchResults.length,
  format: hasOptions ? 'json' as const : 'prose' as const
};
```
- Detects if question has options (A, B, C, D)
- Uses JSON format only when options exist
- Uses prose format for open-ended questions

#### Streaming Camera Search (line ~4080)
- Same logic as non-streaming version
- Detects options with `hasOptions` check
- Conditionally sets `format: 'json'` or `format: 'prose'`

### 4. **Updated Chat Routes** (`server/src/routes/chat.routes.ts`)

All three chat endpoints now explicitly use prose format:

#### `/api/chat/ask-stream` (line ~460)
```typescript
const query: RAGQuery = {
  question: ...,
  topK: retrievedChunks.length,
  format: 'prose' // Chat always uses prose format, never JSON
};
```

#### `/api/chat/ask` (line ~883)
- Same pattern: `format: 'prose'`

#### `/api/chat/deep-search` (line ~1205)
- Same pattern: `format: 'prose'`

## Behavior Summary

| Context | Question Type | Format | Response Style |
|---------|--------------|--------|----------------|
| Camera Search | Multiple Choice (A/B/C/D) | `json` | Structured JSON with correctAnswer, explanation, source, confidence |
| Camera Search | Open-ended (no options) | `prose` | Natural Vietnamese text with citations [🔗n] |
| Chat | Any (even multiple choice) | `prose` | Natural Vietnamese text with citations [🔗n] |

## Example Scenarios

### Camera Search with Options
**Input**: Photo with question and A/B/C/D options
**Format**: `json`
**Output**:
```json
{
  "correctAnswer": "B",
  "explanation": "Theo quy định tại Điều 5...",
  "source": "Điều 5, Khoản 2 - Thông tư 01/2024",
  "confidence": 85
}
```

### Camera Search without Options
**Input**: Photo with open-ended question
**Format**: `prose`
**Output**: "Theo quy định, khách hàng cần đáp ứng các điều kiện sau [🔗1]: Thu nhập ổn định từ 10 triệu/tháng [🔗2]..."

### Chat (any question)
**Input**: "Điều kiện vay vốn là gì?"
**Format**: `prose`
**Output**: "Điều kiện vay vốn bao gồm: có thu nhập ổn định [🔗1], độ tuổi từ 18-65 [🔗2]..."

**Input**: "Câu nào đúng? A) ..., B) ..., C) ..., D) ..."
**Format**: `prose` (even though it's multiple choice)
**Output**: "Đáp án đúng là B [🔗1]. Lý do vì theo Điều 10, Khoản 3..."

## Technical Notes

1. **Backward Compatibility**: Default format is `'prose'`, so existing code without explicit format will work correctly
2. **Type Safety**: Used `as const` for format values to ensure TypeScript type checking
3. **Detection Logic**: Uses `extractedData.optionA && extractedData.optionB` to detect multiple choice (requires at least 2 options)
4. **Prompt Engineering**: JSON prompt explicitly requests structured response; prose prompt requests natural Vietnamese with citation markers
5. **No Breaking Changes**: All existing endpoints continue to work; only added new optional parameter
6. **UI Consistency**: Purple theme distinguishes AI-generated prose from database matches (green) and no results (yellow)

## Frontend Updates (`components/ImageSearchScreen.tsx`)

### Updated Interface
Added `ragResult`, `searchType`, and `extractedOptions` to `SearchResult` interface to support RAG prose display.

### RAG Prose Display (2 locations)
1. **Non-Camera View** (~line 470): Shows RAG prose answer after recognized text
2. **Camera Popup Overlay** (~line 630): Shows RAG prose answer in modal popup

### UI Components
- **Color Theme**: Purple gradient (from-purple-50 to-indigo-50) for AI answers
- **Icon**: 🤖 Robot emoji to indicate AI-generated content
- **Header**: "Câu trả lời từ AI" with confidence percentage badge
- **Answer Card**: White background with border, supports citations [🔗n]
- **Sources Section**: Shows top 3 sources with document name, number, and score percentage
- **Model Info**: Displays model name in italic text at bottom

### Display Logic
```tsx
{searchResult.matchedQuestion ? (
  // Green card: Database match with options
) : searchResult.ragResult ? (
  // Purple card: AI-generated prose answer ✅ NEW
) : (
  // Yellow card: No results found
)}
```

## Testing Checklist

- [x] Camera search with multiple choice question → JSON response (green card)
- [x] Camera search with open-ended question → Prose response (purple AI card) ✅ FIXED
- [ ] Chat with multiple choice question → Prose response (not JSON)
- [ ] Chat with open-ended question → Prose response
- [ ] Verify citations [🔗n] appear in prose responses
- [ ] Verify JSON parsing works for camera search with options
- [ ] Check confidence scores are accurate in both formats
- [ ] Test source document display in purple card
- [ ] Test camera popup overlay shows RAG prose correctly
- [ ] Verify responsiveness on mobile devices
