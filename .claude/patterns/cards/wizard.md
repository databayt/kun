# Wizard Pattern

## Status

| Repo | Pattern | Maturity | Files | Canonical |
|------|---------|----------|-------|-----------|
| hogwarts | factory (createWizardProvider) | production | 6 | **yes** |
| mkan | manual multi-step (host flow) | development | 24 | no |
| shifa | manual multi-step (fellowship) | development | 12 | no |
| codebase | none | none | 0 | no |
| souq | none | none | 0 | no |

## Canonical: hogwarts

### File Structure

```
src/components/form/wizard/
  index.ts              # barrel exports
  config.ts             # WizardConfig, WizardStepMeta, WizardFormRef types
  wizard-provider.tsx   # createWizardProvider factory
  wizard-layout.tsx     # WizardLayout — sidebar nav + content area
  wizard-step.tsx       # WizardStep — individual step wrapper
  wizard-tabs.tsx       # WizardTabs — tab-based step navigation
```

### Architecture

The wizard is URL-routed — each step is a URL segment:
```
/students/create/personal     → step 1
/students/create/guardian      → step 2
/students/create/enrollment   → step 3
```

**Factory pattern:**
```typescript
const config: WizardConfig = {
  id: "student",
  steps: ["personal", "guardian", "enrollment", "contact", "health", "photo"],
  groups: { 0: ["personal", "guardian"], 1: ["enrollment", "contact"], 2: ["health", "photo"] },
  groupLabels: ["Information", "Enrollment", "Documents"],
  requiredSteps: ["personal", "guardian", "enrollment"],
  finalDestination: "/students",
}

const { StudentWizardProvider, useStudentWizard } = createWizardProvider(config)
```

**Each step follows:**
```
wizard/{step}/
  form.tsx         # forwardRef<WizardFormRef> — useForm + zodResolver
  content.tsx      # WizardStep wrapper — loads data, renders form
  actions.ts       # Step-specific server action (save single step)
  validation.ts    # Step-specific Zod schema
```

### Key Types

```typescript
interface WizardConfig {
  id: string
  steps: string[]                          // URL segments
  groups: Record<number, string[]>         // Step grouping for progress
  groupLabels?: string[]
  requiredSteps?: string[]
  finalDestination?: string
}

interface WizardFormRef {
  saveAndNext: () => Promise<void>         // Called by wizard navigation
}
```

### Usage Example

**Step form:**
```tsx
const StepForm = forwardRef<WizardFormRef>((props, ref) => {
  const form = useForm({ resolver: zodResolver(PersonalSchema) })

  useImperativeHandle(ref, () => ({
    saveAndNext: async () => {
      const valid = await form.trigger()
      if (valid) await savePersonalAction(form.getValues())
    }
  }))

  return <Form {...form}><InputField name="firstName" /><InputField name="lastName" /></Form>
})
```

**Wizard layout:**
```tsx
<StudentWizardProvider>
  <WizardLayout config={config}>
    {children}  {/* routed step content */}
  </WizardLayout>
</StudentWizardProvider>
```

## Clone

```
/clone pattern:wizard
/clone hogwarts:src/components/form/wizard/
```

## Migration

**From manual multi-step (mkan/shifa):**
1. Define WizardConfig with steps, groups, requiredSteps
2. Call createWizardProvider(config) to get Provider + hook
3. Convert each step's form.tsx to use forwardRef<WizardFormRef>
4. Move from manual navigation to URL-routed steps
