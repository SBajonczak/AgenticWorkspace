{{- define "agentic-workspace.webName" -}}
{{- .Values.nameOverrides.web | default "agentic-web" -}}
{{- end -}}

{{- define "agentic-workspace.workerName" -}}
{{- .Values.nameOverrides.worker | default "agentic-worker" -}}
{{- end -}}

{{- define "agentic-workspace.configMapName" -}}
{{- .Values.nameOverrides.configMap | default "agentic-config" -}}
{{- end -}}

{{- define "agentic-workspace.secretName" -}}
{{- .Values.secret.name | default "agentic-secrets" -}}
{{- end -}}