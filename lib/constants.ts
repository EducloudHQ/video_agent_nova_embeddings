export const BEDROCK_MODELS = {
  CLAUDE_3_5_SONNET:
    "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-5-sonnet-20240620-v1:0",
  NOVA_MULTIMODAL_EMBEDDINGS:
    "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-2-multimodal-embeddings-v1:0",
  TITAN_EMBED_TEXT:
    "arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v2:0",
};
/**
 * Default API key expiration in days
 */
export const DEFAULT_API_KEY_EXPIRATION_DAYS = 7;