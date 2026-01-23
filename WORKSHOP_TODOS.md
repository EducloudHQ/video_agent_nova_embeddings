# Workshop: Video AI Agent Backend Exercises

This document lists the 16 key tasks you need to complete to get the Video AI Agent backend fully functional. Each task corresponds to a `TODO:` comment in the codebase.

## CDK Infrastructure Exercises

### Exercise 1: Search Function Environment Variables
- **File:** `lib/search-workflow-stack.ts`
- **Task:** Define the environment variables required for the `SearchCutWorkflowFunction`.
- **Instruction:** You need to pass `VECTOR_BUCKET_NAME`, `VECTOR_INDEX_NAME`, `EVENT_BUS_NAME`, and `SOURCE_BUCKET_NAME` from the stack props.

### Exercise 2: Bedrock IAM Permissions
- **File:** `lib/search-workflow-stack.ts`
- **Task:** Grant the search function permission to invoke the Bedrock model.
- **Instruction:** Add a policy statement that allows `bedrock:InvokeModel` on the Nova multimodal embeddings model ARN.

### Exercise 3: S3 CORS Configuration
- **File:** `lib/appsync-construct.ts`
- **Task:** Configure CORS for the media bucket.
- **Instruction:** Allow `GET`, `PUT`, `POST`, and `DELETE` methods from all origins (`*`) to facilitate frontend interaction during development.

### Exercise 4: AppSync API Initialization
- **File:** `lib/appsync-construct.ts`
- **Task:** Initialize the AppSync GraphQL API.
- **Instruction:** Use `appsync.GraphqlApi` with `API_KEY` as the default authorization mode and `USER_POOL` (Cognito) as an additional authorization mode.

### Exercise 13: S3 Bucket Notification
- **File:** `lib/appsync-construct.ts`
- **Task:** Configure S3 to trigger the ingestion workflow.
- **Instruction:** Add an event notification to `mediaBucket` that triggers `invokeWorkflowFunction` whenever an object is created with the `videos/` prefix.

### Exercise 14: AppSync Lambda DataSource & Resolver
- **File:** `lib/appsync-construct.ts`
- **Task:** Expose the `approveVideo` functionality via GraphQL.
- **Instruction:** Add a Lambda data source for `approveVideoFunction` and create a resolver for the `approveVideo` mutation.

### Exercise 15: EventBridge Rule for Pipeline Status
- **File:** `lib/appsync-construct.ts`
- **Task:** Create an EventBridge rule to route backend events to AppSync.
- **Instruction:** Define a rule on the `VideoAgentEventBus` that filters for `video.pipeline` status events and targets the AppSync API with the provided mutation.

### Exercise 16: Lambda EventBridge Permissions
- **File:** `lib/search-workflow-stack.ts`
- **Task:** Grant the search function permission to notify the system.
- **Instruction:** Add an IAM policy statement allowing `events:PutEvents` on the `VideoAgentEventBus` ARN so the search workflow can report its progress.

## Lambda Logic Exercises

### Exercise 5: Generate Embeddings with Bedrock
- **File:** `src/py/search_cut_workflow.py`
- **Task:** Implement the logic to embed the user's search query.
- **Instruction:** Use the `bedrock_runtime.invoke_model` method with the `amazon.nova-2-multimodal-embeddings-v1:0` model ID.

### Exercise 6: Query S3 Vector Index
- **File:** `src/py/search_cut_workflow.py`
- **Task:** Search for the most relevant video segment.
- **Instruction:** Use `s3_vectors.query_vectors` with the generated `query_embedding` and set `topK=1`.

### Exercise 7: FFmpeg Video Cutting
- **File:** `src/py/search_cut_workflow.py`
- **Task:** Construct and execute the FFmpeg command to cut the video clip.
- **Instruction:** Use `-ss` for the start time, `-i` for the input file, `-to` for the end time, and `-c copy` for a fast, lossless cut.

### Exercise 8: Lambda Layers (FFmpeg)
- **File:** `lib/search-workflow-stack.ts`
- **Task:** Attach the FFmpeg layer to the search function.
- **Instruction:** Durable Execution functions often need external tools. Add the `ffmpegLayer` to the `layers` array in the `searchCutWorkflowFunction` definition.

---

## Advanced Exercises (Durable Execution & Event Bridge)

### Exercise 9: Lambda Versioning & Alias for Checkpointing
- **File:** `lib/search-workflow-stack.ts`
- **Task:** Create a Lambda version and an alias named `prod`.
- **Instruction:** Durable Execution requires a stable ARN (alias/version) to maintain execution state during checkpoints. Use `searchCutWorkflowFunction.currentVersion` and create a `lambda.Alias`.

### Exercise 10: EventBridge to GraphQL Mapping
- **File:** `lib/appsync-construct.ts`
- **Task:** Map EventBridge event fields to AppSync mutation variables.
- **Instruction:** Configure the `variables` property of the `AppSync` target using `events.RuleTargetInput.fromObject` and `events.EventField.fromPath`.

### Exercise 11: Human-in-the-loop Callbacks
- **File:** `src/py/search_cut_workflow.py`
- **Task:** Implement a callback to pause the workflow for user approval.
- **Instruction:** Use `context.create_callback` with a 24-hour timeout and then call `callback.result()` to wait for the user's decision.

### Exercise 12: Sending Callback Results
- **File:** `src/py/approve_video.py`
- **Task:** Send success/failure results back to the workflow engine.
- **Instruction:** Use `lambda_client.send_durable_execution_callback_success` (or `failure`) to resume the paused workflow execution with the user's input.

---
**Good luck with the workshop!**
