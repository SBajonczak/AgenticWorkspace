variable "azure_subscription_id" {
  description = "Azure Subscription ID"
  type        = string
}

variable "azure_tenant_id" {
  description = "Azure Tenant ID (from AZURE_TENANT_ID env)"
  type        = string
}

variable "aks_resource_group_name" {
  description = "Resource group containing the existing AKS cluster"
  type        = string
}

variable "aks_cluster_name" {
  description = "Name of the existing AKS cluster"
  type        = string
}

variable "acr_resource_group_name" {
  description = "Resource group containing the existing Azure Container Registry"
  type        = string
}

variable "acr_name" {
  description = "Name of the existing Azure Container Registry"
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

variable "sql_server_name" {
  description = "Name of the Azure SQL logical server (globally unique)"
  type        = string
  default     = "sql-agentic-workspace"
}

variable "sql_database_name" {
  description = "Name of the Azure SQL database"
  type        = string
  default     = "agenticdb"
}

variable "sql_admin_login" {
  description = "Azure SQL admin login name"
  type        = string
}

variable "sql_admin_password" {
  description = "Azure SQL admin password"
  type        = string
  sensitive   = true
}

variable "sql_sku_name" {
  description = "Azure SQL SKU. Serverless example: GP_S_Gen5_1"
  type        = string
  default     = "GP_S_Gen5_1"
}

variable "sql_min_capacity" {
  description = "Minimum vCore capacity for Azure SQL serverless"
  type        = number
  default     = 0.5
}

variable "sql_auto_pause_delay_in_minutes" {
  description = "Auto-pause delay in minutes for Azure SQL serverless"
  type        = number
  default     = 60
}

variable "github_org_name" {
  description = "GitHub organization name"
  type        = string
}

variable "github_repo_name" {
  description = "GitHub repository name"
  type        = string
}

variable "github_environment_name" {
  description = "GitHub environment name used by deployments"
  type        = string
  default     = "production"
}

variable "github_identity_name" {
  description = "Name of the user-assigned managed identity for GitHub OIDC"
  type        = string
  default     = "uami-gha-agentic-workspace"
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
