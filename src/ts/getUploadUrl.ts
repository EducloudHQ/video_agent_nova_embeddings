import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({});

export const handler = async (event: any) => {
    console.log("Received event:", JSON.stringify(event, null, 2));

    const { fileName, contentType } = event.arguments;
    const bucketName = process.env.BUCKET_NAME;

    if (!bucketName) {
        throw new Error("BUCKET_NAME environment variable is not set");
    }

    // Ensure the file is uploaded to the videos/ directory
    const key = `videos/${fileName}`;

    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        ContentType: contentType,
    });

    try {
        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        
        return {
            url: signedUrl,
            fileName: fileName,
        };
    } catch (error) {
        console.error("Error generating signed URL:", error);
        throw new Error("Could not generate upload URL");
    }
};
