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

# Resource Group
resource "azurerm_resource_group" "main" {
  name     = var.resource_group_name
  location = var.location
  tags     = var.tags
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
