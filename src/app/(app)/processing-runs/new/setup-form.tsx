"use client";

import { useActionState, useState } from "react";
import { Field, TextInput, Textarea, Select, PrimaryButton, ErrorText } from "@/components/ui";
import { createProcessingRun, type FormState } from "@/app/actions/processing-runs";

type Env = { id: string; name: string };
type Dataset = { id: string; name: string; environment_id: string };

const AI_SOURCES = [
  { value: "mock", label: "Mock / Test Adapter — demo and testing only" },
  { value: "smartdiscovery", label: "SmartDiscovery Adapter" },
  { value: "external_ai", label: "External AI Adapter" },
  { value: "manual", label: "Manual Analysis Adapter" },
];

export function SetupForm({
  environments,
  datasets,
  defaultEnvironmentId,
  defaultDatasetId,
  learnerId,
  learnerName,
}: {
  environments: Env[];
  datasets: Dataset[];
  defaultEnvironmentId?: string;
  defaultDatasetId?: string;
  learnerId?: string;
  learnerName?: string;
}) {
  const [environmentId, setEnvironmentId] = useState(defaultEnvironmentId ?? "");
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createProcessingRun,
    undefined,
  );

  const filteredDatasets = datasets.filter((d) => d.environment_id === environmentId);

  return (
    <form action={formAction} className="space-y-6">
      {learnerId && <input type="hidden" name="learnerId" value={learnerId} />}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Learning environment" htmlFor="environmentId" required>
          <Select
            id="environmentId"
            name="environmentId"
            required
            value={environmentId}
            onChange={(e) => setEnvironmentId(e.target.value)}
          >
            <option value="" disabled>
              Select an environment
            </option>
            {environments.map((env) => (
              <option key={env.id} value={env.id}>
                {env.name}
              </option>
            ))}
          </Select>
        </Field>
        {learnerId ? (
          <Field label="Scope" htmlFor="learnerScope">
            <div
              id="learnerScope"
              className="flex h-10 items-center rounded-lg border border-border bg-surface-pale px-3 text-sm text-foreground"
            >
              Scoped to: {learnerName ?? "this learner"}
            </div>
          </Field>
        ) : (
          <Field label="Dataset" htmlFor="datasetId" required>
            <Select id="datasetId" name="datasetId" required defaultValue={defaultDatasetId ?? ""} disabled={!environmentId}>
              <option value="" disabled>
                {environmentId ? "Select a dataset" : "Select an environment first"}
              </option>
              {filteredDatasets.map((ds) => (
                <option key={ds.id} value={ds.id}>
                  {ds.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-foreground">Processing context</h2>
        <p className="mt-1 text-xs text-foreground-muted">
          Stored with the run — SmartDiscovery uses this for interpretation (spec §4.4).
        </p>
        <div className="mt-3 space-y-4">
          <Field label="Learning objective" htmlFor="learningObjective" required>
            <Textarea id="learningObjective" name="learningObjective" rows={2} required />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Course / activity context" htmlFor="activityContext">
              <TextInput id="activityContext" name="activityContext" />
            </Field>
            <Field label="Learner population" htmlFor="learnerPopulation">
              <TextInput id="learnerPopulation" name="learnerPopulation" />
            </Field>
            <Field label="Activity type" htmlFor="activityType">
              <TextInput id="activityType" name="activityType" placeholder="e.g. reflection, assignment" />
            </Field>
            <Field label="Interpretation focus" htmlFor="interpretationFocus">
              <TextInput id="interpretationFocus" name="interpretationFocus" />
            </Field>
          </div>
          <Field label="Signal categories" htmlFor="signalCategories">
            <TextInput
              id="signalCategories"
              name="signalCategories"
              placeholder="e.g. strength, need, concern, preference"
            />
          </Field>
          <Field label="Taxonomy / interpretation guidance" htmlFor="taxonomyGuidance">
            <Textarea id="taxonomyGuidance" name="taxonomyGuidance" rows={2} />
          </Field>
          <Field label="Processing notes" htmlFor="processingNotes">
            <Textarea id="processingNotes" name="processingNotes" rows={2} />
          </Field>
          <Field label="Fields to use as evidence" htmlFor="evidenceFields" required>
            <TextInput
              id="evidenceFields"
              name="evidenceFields"
              required
              placeholder="Comma-separated column names from the dataset, e.g. reflection_text, notes"
            />
          </Field>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-foreground">AI configuration</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Adapter" htmlFor="aiSource" required>
            <Select id="aiSource" name="aiSource" defaultValue="mock">
              {AI_SOURCES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Model / tool (optional)" htmlFor="modelOrTool">
            <TextInput id="modelOrTool" name="modelOrTool" placeholder="e.g. claude-sonnet-5" />
          </Field>
        </div>
      </div>

      <ErrorText>{state?.error}</ErrorText>

      <PrimaryButton type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save as draft"}
      </PrimaryButton>
    </form>
  );
}
