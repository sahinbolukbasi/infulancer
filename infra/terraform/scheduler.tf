# Agent job'ları: EventBridge Scheduler → aynı imajla kısa ömürlü Fargate görevi
# (`npm run agents:run -- --job <ad>`). Takvim packages/core/src/agents/registry.ts ile aynıdır.
locals {
  agent_jobs = var.enable_agent_schedules ? {
    "publish-check"             = "rate(15 minutes)"
    "story-reminder"            = "rate(1 hour)"
    "brief-compliance"          = "rate(1 hour)"
    "metric-consistency"        = "rate(1 hour)"
    "campaign-summary"          = "rate(1 hour)"
    "deletion-check"            = "cron(0 4 * * ? *)"
    "target-projection"         = "cron(0 5 * * ? *)"
    "influencer-recommendation" = "cron(0 6 * * ? *)"
    "fake-engagement"           = "cron(0 3 1 * ? *)"
    "iys-register"              = "rate(1 hour)"
    "iys-sla"                   = "rate(1 hour)"
    "kvkk-reminders"            = "cron(0 7 * * ? *)"
    "channel-health"            = "rate(1 hour)"
    "window-warnings"           = "rate(5 minutes)"
    "campaign-auto-close"       = "rate(1 hour)"
    "ads-budget-batch"          = "cron(0 * * * ? *)"
    "webhook-dedupe-ttl"        = "cron(30 3 * * ? *)"
    "social-sync"               = "rate(6 hours)"
    "trackers"                  = "rate(1 hour)"
    "offer-expiry"              = "rate(1 hour)"
  } : {}
}

data "aws_iam_policy_document" "scheduler_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["scheduler.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "scheduler" {
  name               = "${local.name}-scheduler"
  assume_role_policy = data.aws_iam_policy_document.scheduler_assume.json
}

resource "aws_iam_role_policy" "scheduler" {
  name = "run-agent-tasks"
  role = aws_iam_role.scheduler.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Action    = ["ecs:RunTask"]
        Resource  = ["arn:aws:ecs:${var.region}:${local.account_id}:task-definition/${local.name}:*"]
        Condition = { ArnLike = { "ecs:cluster" = aws_ecs_cluster.main.arn } }
      },
      { Effect = "Allow", Action = ["iam:PassRole"], Resource = [aws_iam_role.execution.arn, aws_iam_role.task.arn] },
    ]
  })
}

resource "aws_scheduler_schedule_group" "agents" {
  name = "${local.name}-agents"
}

resource "aws_scheduler_schedule" "agent" {
  for_each   = local.agent_jobs
  name       = each.key
  group_name = aws_scheduler_schedule_group.agents.name

  schedule_expression          = each.value
  schedule_expression_timezone = "Europe/Istanbul"

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = aws_ecs_cluster.main.arn
    role_arn = aws_iam_role.scheduler.arn

    ecs_parameters {
      task_definition_arn = aws_ecs_task_definition.app.arn
      launch_type         = "FARGATE"
      task_count          = 1
      network_configuration {
        subnets          = aws_subnet.public[*].id
        security_groups  = [aws_security_group.app.id]
        assign_public_ip = true
      }
    }

    input = jsonencode({
      containerOverrides = [{
        name    = "app"
        command = ["npm", "run", "agents:run", "-w", "@infulancer/core", "--", "--job", each.key]
      }]
    })

    retry_policy {
      maximum_retry_attempts = 1
    }
  }
}
