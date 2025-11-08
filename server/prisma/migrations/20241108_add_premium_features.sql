-- Remove premiumQuota column (using aiSearchQuota instead for unified quota system)
-- Note: This will drop the column and its data
ALTER TABLE User DROP COLUMN premiumQuota;

-- Update aiSearchQuota comment to reflect it includes chat
-- (SQLite doesn't support COMMENT modification, so this is just documentation)

-- Add new columns to ChatMessage table  
ALTER TABLE chat_messages ADD COLUMN isDeepSearch BOOLEAN DEFAULT false;
ALTER TABLE chat_messages ADD COLUMN confidence REAL;
ALTER TABLE chat_messages ADD COLUMN cacheHit BOOLEAN DEFAULT false;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_isDeepSearch ON chat_messages(isDeepSearch);
CREATE INDEX IF NOT EXISTS idx_chat_messages_confidence ON chat_messages(confidence);
CREATE INDEX IF NOT EXISTS idx_chat_messages_cacheHit ON chat_messages(cacheHit);

-- Update existing chat messages with default values
UPDATE chat_messages SET isDeepSearch = false WHERE isDeepSearch IS NULL;
UPDATE chat_messages SET cacheHit = false WHERE cacheHit IS NULL;