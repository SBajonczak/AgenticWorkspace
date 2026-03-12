variable "azure_subscription_id" {
  description = "Azure Subscription ID"
  type        = string
}

variable "azure_tenant_id" {
  description = "Azure Tenant ID (from AZURE_TENANT_ID env)"
  type        = string
}

variable "resource_group_name" {
  description = "Name of the Azure Resource Group to create"
  type        = string
  default     = "rg-agentic-workspace"
}

variable "location" {
  description = "Azure region for all resources"
  type        = string
  default     = "westeurope"
}

variable "openai_account_name" {
  description = "Name of the Azure OpenAI account (must be globally unique)"
  type        = string
  default     = "oai-agentic-workspace"
}

variable "openai_deployment_name" {
  description = "Name for the gpt-4o-mini deployment"
  type        = string
  default     = "gpt-4o-mini"
}

variable "openai_capacity" {
  description = "Tokens per minute capacity in thousands (minimum 1, default 30 = 30K TPM)"
  type        = number
  default     = 30
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default = {
    project     = "agentic-workspace"
    environment = "production"
    managed-by  = "terraform"
  }
}
