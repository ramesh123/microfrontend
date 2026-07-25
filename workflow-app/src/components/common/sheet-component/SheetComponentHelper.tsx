import { ValidationHelper } from '@/types/dataValidation';
import NWayValidationHelper from '@/components/common/nway-validation/components/column-mapping-component/NWayValidationHelper';
import MultiSourceValidationHelper from '../multisource-validation/components/column-mapping-component/MultiSourceValidationHelper';

export const buildSavePayload = (nodeData) => {
  const { data } = nodeData
  let validationObj: ValidationHelper = null
  switch (data.node_id) {
    case 'nway_validation':
      validationObj = new NWayValidationHelper()
      break
    case 'multisource_validation':
      validationObj = new MultiSourceValidationHelper()
      break
    default:
      throw Error("Cannot build payload")
  }
  return validationObj?.buildSavePayload(nodeData) ?? {}
}

