terraform {
  required_version = ">= 1.5.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.90"
    }
  }
}

provider "azurerm" {
  features {}
  subscription_id = var.azure_subscription_id
  tenant_id       = var.azure_tenant_id
}

data "azurerm_kubernetes_cluster" "existing" {
  name                = var.aks_cluster_name
  resource_group_name = var.aks_resource_group_name
}

data "azurerm_container_registry" "existing" {
  name                = var.acr_name
  resource_group_name = var.acr_resource_group_name
}

# Resource Group
resource "azurerm_resource_group" "main" {
  name     = var.resource_group_name
  location = var.location
  tags     = var.tags
}

resource "azurerm_mssql_server" "main" {
  name                         = var.sql_server_name
  resource_group_name          = azurerm_resource_group.main.name
  location                     = azurerm_resource_group.main.location
  version                      = "12.0"
  administrator_login          = var.sql_admin_login
  administrator_login_password = var.sql_admin_password
  minimum_tls_version          = "1.2"
  tags                         = var.tags
}

resource "azurerm_mssql_database" "main" {
  name                        = var.sql_database_name
  server_id                   = azurerm_mssql_server.main.id
  collation                   = "SQL_Latin1_General_CP1_CI_AS"
  sku_name                    = var.sql_sku_name
  min_capacity                = var.sql_min_capacity
  auto_pause_delay_in_minutes = var.sql_auto_pause_delay_in_minutes
  tags                        = var.tags
}

resource "azurerm_mssql_firewall_rule" "allow_azure_services" {
  name             = "AllowAzureServices"
  server_id        = azurerm_mssql_server.main.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

resource "azurerm_user_assigned_identity" "github_actions" {
  name                = var.github_identity_name
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  tags                = var.tags
}

resource "azurerm_federated_identity_credential" "github_actions" {
  name                = "fic-${var.github_repo_name}-${var.github_environment_name}"
  resource_group_name = azurerm_resource_group.main.name
  parent_id           = azurerm_user_assigned_identity.github_actions.id
  audience            = ["api://AzureADTokenExchange"]
  issuer              = "https://token.actions.githubusercontent.com"
  subject             = "repo:${var.github_org_name}/${var.github_repo_name}:environment:${var.github_environment_name}"
}

resource "azurerm_role_assignment" "github_rg_contributor" {
  scope                = azurerm_resource_group.main.id
  role_definition_name = "Contributor"
  principal_id         = azurerm_user_assigned_identity.github_actions.principal_id
}

resource "azurerm_role_assignment" "github_acr_push" {
  scope                = data.azurerm_container_registry.existing.id
  role_definition_name = "AcrPush"
  principal_id         = azurerm_user_assigned_identity.github_actions.principal_id
}

resource "azurerm_role_assignment" "github_aks_cluster_user" {
  scope                = data.azurerm_kubernetes_cluster.existing.id
  role_definition_name = "Azure Kubernetes Service Cluster User Role"
  principal_id         = azurerm_user_assigned_identity.github_actions.principal_id
}

# Azure OpenAI Account (cost-optimized: Standard S0)
resource "azurerm_cognitive_account" "openai" {
  name                = var.openai_account_name
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  kind                = "OpenAI"

  # S0 is the only available SKU for Azure OpenAI
  sku_name = "S0"

  # Restrict to tenant only – do not allow external access
  custom_subdomain_name = var.openai_account_name

  # Network access: allow all (restrict to your IP/VNet in production)
  public_network_access_enabled = true

  tags = var.tags
}

# gpt-4o-mini deployment – cheapest capable model
# ~$0.15/1M input tokens, ~$0.60/1M output tokens
resource "azurerm_cognitive_deployment" "gpt4o_mini" {
  name                 = var.openai_deployment_name
  cognitive_account_id = azurerm_cognitive_account.openai.id

  model {
    format  = "OpenAI"
    name    = "gpt-4o-mini"
    version = "2024-07-18"
  }

  scale {
    type     = "Standard"
    capacity = var.openai_capacity
  }
}
