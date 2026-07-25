import { useLocation } from 'react-router';
import { useDynamicFormAssignmentStore } from '../../stores/useDynamicFormAssignmentStore';
import { DynamicFormRuntimeView } from './DynamicFormRuntimeView';

const BUILDER_PATH = '/dynamic-forms';

interface DynamicFormRouteOverrideProps {
  children: React.ReactNode;
}

export function DynamicFormRouteOverride({ children }: DynamicFormRouteOverrideProps) {
  const location = useLocation();
  const assignment = useDynamicFormAssignmentStore((state) => state.getAssignmentForPath(location.pathname));

  if (location.pathname === BUILDER_PATH || !assignment) {
    return children;
  }

  return <DynamicFormRuntimeView assignment={assignment} />;
}
