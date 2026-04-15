output "openai_endpoint" {
  description = "Azure OpenAI endpoint URL – use as AZURE_OPENAI_ENDPOINT"
  value       = azurerm_cognitive_account.openai.endpoint
}

output "openai_api_key" {
  description = "Azure OpenAI primary API key – use as AZURE_OPENAI_API_KEY"
  value       = azurerm_cognitive_account.openai.primary_access_key
  sensitive   = true
}

output "openai_deployment_name" {
  description = "Deployment name – use as AZURE_OPENAI_DEPLOYMENT"
  value       = azurerm_cognitive_deployment.gpt4o_mini.name
}

output "resource_group_name" {
  description = "Resource group name"
  value       = azurerm_resource_group.main.name
}

output "aks_cluster_name" {
  description = "Existing AKS cluster name"
  value       = data.azurerm_kubernetes_cluster.existing.name
}

output "aks_resource_group_name" {
  description = "Existing AKS resource group name"
  value       = data.azurerm_kubernetes_cluster.existing.resource_group_name
}

output "acr_login_server" {
  description = "Azure Container Registry login server"
  value       = data.azurerm_container_registry.existing.login_server
}

output "kubernetes_namespace" {
  description = "Kubernetes namespace targeted by manifests"
  value       = "agentic-workspace"
}

output "sql_server_fqdn" {
  description = "Azure SQL server FQDN"
  value       = azurerm_mssql_server.main.fully_qualified_domain_name
}

output "sql_database_name" {
  description = "Azure SQL database name"
  value       = azurerm_mssql_database.main.name
}

output "github_client_id" {
  description = "Managed identity client ID for GitHub OIDC azure/login"
  value       = azurerm_user_assigned_identity.github_actions.client_id
}

output "github_tenant_id" {
  description = "Tenant ID to use in GitHub azure/login"
  value       = var.azure_tenant_id
}

output "github_subscription_id" {
  description = "Subscription ID to use in GitHub azure/login"
  value       = var.azure_subscription_id
}

output "env_snippet" {
  description = "Copy these values into your .env file"
  value       = <<-EOT
    # Add these to your .env file:
    AZURE_OPENAI_ENDPOINT="${azurerm_cognitive_account.openai.endpoint}"
    AZURE_OPENAI_DEPLOYMENT="${azurerm_cognitive_deployment.gpt4o_mini.name}"
    DATABASE_PROVIDER="mssql"
    DATABASE_URL="sqlserver://${var.sql_server_name}.database.windows.net:1433;database=${azurerm_mssql_database.main.name};user=${var.sql_admin_login};password=<password>;encrypt=true;trustServerCertificate=false;"
    # AZURE_OPENAI_API_KEY=<run: terraform output -raw openai_api_key>
  EOT
}
