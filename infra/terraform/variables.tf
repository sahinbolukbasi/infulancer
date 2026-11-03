variable "project" {
  type    = string
  default = "infulancer"
}

variable "environment" {
  type    = string
  default = "prod"
}

variable "region" {
  type    = string
  default = "eu-central-1"
}

variable "aws_profile" {
  description = "Yerel AWS CLI profili (boşsa varsayılan kimlik zinciri)."
  type        = string
  default     = ""
}

variable "image_tag" {
  description = "ECR'deki uygulama imajı etiketi."
  type        = string
  default     = "latest"
}

variable "app_desired_count" {
  description = "Çalışan web görevi sayısı (0 = durdurulmuş)."
  type        = number
  default     = 1
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "db_allocated_storage" {
  type    = number
  default = 20
}

variable "seed_on_start" {
  description = "Boş veritabanında demo verisini yükle (yalnız demo/pilot)."
  type        = bool
  default     = true
}

variable "llm_provider" {
  description = "mock | bedrock. bedrock için model erişimi Bedrock konsolunda açılmış olmalı."
  type        = string
  default     = "mock"

  validation {
    condition     = contains(["mock", "bedrock"], var.llm_provider)
    error_message = "llm_provider mock veya bedrock olmalı."
  }
}

variable "bedrock_text_model_id" {
  description = "Bölgeye göre config değeri (kodda sabit değil). Ör. eu.anthropic.claude-haiku-4-5-20251001-v1:0"
  type        = string
  default     = "eu.anthropic.claude-haiku-4-5-20251001-v1:0"
}

variable "bedrock_vision_model_id" {
  type    = string
  default = "eu.anthropic.claude-haiku-4-5-20251001-v1:0"
}

variable "enable_agent_schedules" {
  description = "Agent job'larını EventBridge Scheduler ile Fargate görevi olarak çalıştır."
  type        = bool
  default     = true
}
