# Form Pattern

## Status

| Repo | Pattern | Maturity | Files | Canonical |
|------|---------|----------|-------|-----------|
| hogwarts | central-block (14 atoms + wizard + bridges) | production | 22 | **yes** |
| codebase | primitive-only (shadcn form.tsx) | partial | 1 | no |
| mkan | triple-file (form + hook + validation per step) | development | 28 | no |
| shifa | inline-useForm | development | 24 | no |
| souq | plain-react-state (no RHF) | none | 0 | no |

## Canonical: hogwarts

### File Structure

```
src/components/form/
  index.ts              # barrel exports
  types.ts              # FormStep, MultiStepFormConfig, BaseFieldProps, ActionResponse
  actions.ts            # createFormAction, createGenericAction, CRUD helpers
  use-form.ts           # useFormAnalytics, useFormPersistence, useActionStateBridge
  footer.tsx            # FormFooter with step configs
  atoms/
    index.ts
    input.tsx           # InputField, TextField
    number.tsx          # NumberField
    select.tsx          # SelectField
    textarea.tsx        # TextareaField
    checkbox.tsx        # CheckboxField
    date.tsx            # DateField
    name-fields.tsx     # NameFields (composite: firstName + lastName)
    switch.tsx          # SwitchField
    radio-group.tsx     # RadioGroupField
    combobox.tsx        # ComboboxField
    file-upload.tsx     # FileUploadField
    phone.tsx           # PhoneField
    country.tsx         # CountryField
  template/
    index.ts
    provider.tsx        # MultiStepFormProvider
    modal.tsx           # ModalMultiStepForm
    container.tsx       # FormStepContainer
    header.tsx          # FormStepHeader
    heading.tsx         # FormHeading
    layout.tsx          # FormLayout
    navigation.tsx      # FormStepNavigation
    progress.tsx        # FormStepProgress
    success.tsx         # FormSuccess
    field-array.tsx     # FieldArray
    password-field.tsx  # PasswordField
    wizard-validation-context.tsx
  wizard/
    index.ts
    config.ts           # WizardConfig, WizardStepMeta, WizardFormRef
    wizard-provider.tsx # createWizardProvider factory
    wizard-layout.tsx   # WizardLayout
    wizard-step.tsx     # WizardStep
    wizard-tabs.tsx     # WizardTabs
  bridges/
    index.ts
    use-host-bridge.ts
    use-apply-bridge.ts
    use-modal-bridge.ts
```

### Architecture

Three form patterns, each for a different complexity level:

**1. Triplet (Simple CRUD)** — Modal-based create/edit with useModal context
```
feature/form.tsx + validation.ts + actions.ts
```
Used by: academic config (levels, years, periods, terms, grading), classrooms, parents, staff

**2. Wizard (Complex entities)** — URL-routed multi-step with createWizardProvider
```
feature/wizard/config.ts + use-{entity}-wizard.ts + {step}/form.tsx
```
Used by: students (10 steps), teachers (9 steps), events (3 steps), announcements (2 steps)

**3. Application (Public-facing)** — Multi-step with progress, auto-save, persistence
```
application/{step}/form.tsx + content.tsx + actions.ts + validation.ts
```
Used by: school application (7 steps)

### Key Types

```typescript
interface BaseFieldProps {
  name: string
  label?: string
  description?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  className?: string
}

interface ActionResponse<T = unknown> {
  success: boolean
  data?: T
  errors?: Record<string, string[]>
  message?: string
}

interface WizardConfig {
  id: string
  steps: string[]
  groups: Record<number, string[]>
  groupLabels?: string[]
  requiredSteps?: string[]
  finalDestination?: string
}

interface WizardFormRef {
  saveAndNext: () => Promise<void>
}
```

### Usage Example

**Simple form field:**
```tsx
import { InputField, SelectField, DateField } from "@/components/form"

<InputField name="email" label="Email" type="email" required />
<SelectField name="role" label="Role" options={roleOptions} />
<DateField name="birthDate" label="Birth Date" />
```

**Server action with factory:**
```tsx
import { createFormAction, ActionResponse } from "@/components/form"

const action = await createFormAction(StudentSchema, async (data, schoolId) => {
  return prisma.student.create({ data: { ...data, schoolId } })
})
```

**React 19 bridge (useActionState + react-hook-form):**
```tsx
import { useActionStateBridge } from "@/components/form"

const { form, isPending, handleSubmit } = useActionStateBridge({
  schema: StudentSchema,
  action: createStudentAction,
  onSuccess: () => router.push("/students"),
})
```

**Wizard setup:**
```tsx
import { createWizardProvider, WizardLayout, WizardStep } from "@/components/form"

const config: WizardConfig = {
  id: "teacher",
  steps: ["info", "contact", "qualifications", "photo"],
  groups: { 0: ["info", "contact"], 1: ["qualifications", "photo"] },
  requiredSteps: ["info", "contact"],
}

const { TeacherWizardProvider, useTeacherWizard } = createWizardProvider(config)
```

## Clone

```
/clone pattern:form
/clone hogwarts:src/components/form/
```

## Migration

**From inline useForm (mkan/shifa):**
1. Install form block from codebase
2. Replace raw `<FormField>` + `<FormItem>` + `<Input>` with `<InputField name="x" label="Y" />`
3. Replace inline Zod schemas with dedicated `validation.ts`
4. Replace manual `useForm` setup with `useActionStateBridge` for server actions
5. For multi-step: convert per-step files to wizard pattern with `createWizardProvider`

**From no form system (souq):**
1. Add react-hook-form + @hookform/resolvers + zod
2. Install form block
3. Convert plain React state forms to InputField/SelectField pattern
