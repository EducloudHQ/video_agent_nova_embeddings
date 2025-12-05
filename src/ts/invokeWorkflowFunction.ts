
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";

import { logger, metrics, tracer } from "./powertools/utilities";

export const handler = async (event: any, _context: any) => {
  logger.info("Received event", { event });

  const generateEmbeddingsSMArn =
    process.env.STATE_MACHINE_ARN;
    const bucketName = process.env.SOURCE_BUCKET_NAME;

  if (!generateEmbeddingsSMArn) {
    logger.error("STATE_MACHINE_ARN is not configured.");
    return false;
  }

  const client = new SFNClient({});

  for (const record of event.Records) {
    // the mediaBucketUri and mediaBucket should be similar to these
     // "mediaBucket": "s3://s3-features-source-132260253285",
  //"mediaFileUri": "s3://s3-features-source-132260253285/NetflixMeridian.mp4"
    
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
    const mediaFileUri = `s3://${bucketName}/${record.s3.object.key}`;
    const mediaBucket = `s3://${bucketName}`;
    const input = JSON.stringify({ 
     mediaBucket:mediaBucket,
     mediaFileUri:mediaFileUri
    });

    logger.info(`Starting Step Functions execution for ${bucketName}/${key}`, { input });

    try {
      const command = new StartExecutionCommand({
        stateMachineArn: generateEmbeddingsSMArn,
        input: input,
      });
      await client.send(command);
      logger.info(`Successfully started execution for ${bucketName}/${key}`);
    } catch (error: any) {
      logger.error("Error starting Step Functions execution", { error, bucketName, key });
      // Continue processing other records even if one fails
    }
  }

  return true;
};
