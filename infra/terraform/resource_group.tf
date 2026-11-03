# Tüm kaynaklar Project etiketiyle tek bir Resource Group altında görünür.
resource "aws_resourcegroups_group" "project" {
  name        = local.name
  description = "Infulancer platformunun tum AWS kaynaklari"

  resource_query {
    query = jsonencode({
      ResourceTypeFilters = ["AWS::AllSupported"]
      TagFilters = [
        { Key = "Project", Values = [var.project] },
        { Key = "Environment", Values = [var.environment] },
      ]
    })
  }
}
