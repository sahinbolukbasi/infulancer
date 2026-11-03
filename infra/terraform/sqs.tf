# Agent olay kuyruğu (EVENT_MODE=sqs için hazır). Varsayılan dağıtımda olaylar web
# sürecinde inline işlenir; kuyruk tüketicisi (packages/core/src/lambda/sqs.ts) sonraki adımda bağlanır.
resource "aws_sqs_queue" "agent_events_dlq" {
  name                      = "${local.name}-agent-events-dlq"
  message_retention_seconds = 1209600
  sqs_managed_sse_enabled   = true
}

resource "aws_sqs_queue" "agent_events" {
  name                       = "${local.name}-agent-events"
  visibility_timeout_seconds = 300
  sqs_managed_sse_enabled    = true
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.agent_events_dlq.arn
    maxReceiveCount     = 5
  })
}
