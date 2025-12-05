import { AppSyncResolverHandler } from "aws-lambda";
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";

import { logger, metrics, tracer } from "./powertools/utilities";

export const handler = async (event: any, _context: any) => {
  logger.info("Received event", { event });

  const generateEmbeddingsSMArn =
    process.env.STATE_MACHINE_ARN;

  if (!generateEmbeddingsSMArn) {
    logger.error("STATE_MACHINE_ARN is not configured.");
    return false;
  }

  const client = new SFNClient({});

  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
    
    const input = JSON.stringify({ 
      bucket,
      key
    });

    logger.info(`Starting Step Functions execution for ${bucket}/${key}`, { input });

    try {
      const command = new StartExecutionCommand({
        stateMachineArn: generateEmbeddingsSMArn,
        input: input,
      });
      await client.send(command);
      logger.info(`Successfully started execution for ${bucket}/${key}`);
    } catch (error: any) {
      logger.error("Error starting Step Functions execution", { error, bucket, key });
      // Continue processing other records even if one fails
    }
  }

  return true;
};
