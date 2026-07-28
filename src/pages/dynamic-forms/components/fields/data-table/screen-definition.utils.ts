import { ALL_FIELD_TYPES } from '../../../constants';
import { createDefaultField } from '../../../lib/field/field.utils';
import { getNextFieldLayout } from '../../../lib/grid/form-builder-grid.utils';
import { createDefaultApiLogicStep } from '../../../lib/logic/form-logic.utils';
import type {
  FormBuilderDefinition,
  FormBuilderField,
  FormBuilderTableScreenField,
  FormBuilderTableScreenFieldType,
} from '../../../types';

export function createEmptyScreenDefinition(title = 'Edit'): FormBuilderDefinition {
  return {
    id: crypto.randomUUID(),
    title,
    description: '',
    fields: [],
    apiLogic: { steps: [createDefaultApiLogicStep()] },
  };
}

function mapScreenTypeToFieldType(
  type: FormBuilderTableScreenFieldType,
): FormBuilderField['type'] {
  return type;
}

/** Migrate legacy flat screenFields into a full form definition. */
export function screenFieldsToDefinition(
  screenFields: FormBuilderTableScreenField[],
  title = 'Edit',
): FormBuilderDefinition {
  const definition = createEmptyScreenDefinition(title);
  let fields: FormBuilderField[] = [];

  for (const screenField of screenFields) {
    const field = {
      ...createDefaultField(
        mapScreenTypeToFieldType(screenField.type),
        fields.length,
        ALL_FIELD_TYPES,
        screenField.label,
      ),
      name: screenField.name,
      required: !!screenField.required,
      placeholder: screenField.placeholder,
      options: screenField.options,
      apiSource: screenField.responseKey
        ? { responseKey: screenField.responseKey }
        : undefined,
    };
    field.layout = getNextFieldLayout(fields, field.type);
    fields = [...fields, field];
  }

  return { ...definition, fields };
}

export function resolveScreenDefinition(action: {
  screenDefinition?: FormBuilderDefinition;
  screenFields?: FormBuilderTableScreenField[];
  screenTitle?: string;
  label?: string;
}): FormBuilderDefinition {
  if (action.screenDefinition) {
    return {
      ...action.screenDefinition,
      apiLogic: action.screenDefinition.apiLogic ?? {
        steps: [createDefaultApiLogicStep()],
      },
    };
  }
  if (action.screenFields?.length) {
    return screenFieldsToDefinition(
      action.screenFields,
      action.screenTitle ?? action.label ?? 'Edit',
    );
  }
  return createEmptyScreenDefinition(action.screenTitle ?? action.label ?? 'Edit');
}
