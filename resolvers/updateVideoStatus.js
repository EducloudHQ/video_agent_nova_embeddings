export const request = (ctx) => {
  // const input = ctx.args.input;
  return {};
};

export const response = (ctx) => {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }
  return {
    requestId: ctx.args.requestId,
    status: ctx.args.status,
    message: ctx.args.message,
    callbackId: ctx.args.callbackId,
    videoUrl: ctx.args.videoUrl,
  };
};