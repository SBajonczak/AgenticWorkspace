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

{{- define "agentic-workspace.configChecksum" -}}
{{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}
{{- end -}}

{{- define "agentic-workspace.secretChecksum" -}}
{{- if .Values.secret.create -}}
{{ include (print $.Template.BasePath "/secret.yaml") . | sha256sum }}
{{- else -}}
{{- $existingSecret := lookup "v1" "Secret" .Values.namespace (include "agentic-workspace.secretName" .) -}}
{{- if $existingSecret -}}
{{ toYaml $existingSecret.data | sha256sum }}
{{- else -}}
missing-secret
{{- end -}}
{{- end -}}
{{- end -}}