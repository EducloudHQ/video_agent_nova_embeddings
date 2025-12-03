import { Handler } from "aws-lambda";
export const handler: Handler = async (event, context) => {
  console.log(`received scheduled post event`);
  console.log(JSON.stringify(event));
};

