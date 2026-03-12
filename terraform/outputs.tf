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

output "env_snippet" {
  description = "Copy these values into your .env file"
  value = <<-EOT
    # Add these to your .env file:
    AZURE_OPENAI_ENDPOINT="${azurerm_cognitive_account.openai.endpoint}"
    AZURE_OPENAI_DEPLOYMENT="${azurerm_cognitive_deployment.gpt4o_mini.name}"
    # AZURE_OPENAI_API_KEY=<run: terraform output -raw openai_api_key>
  EOT
}
