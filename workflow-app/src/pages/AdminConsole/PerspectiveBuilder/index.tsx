import { useOrganizationStore } from "@/stores/organizationStore";
import { useEffect, useRef, useState } from "react";
import { Organization, Perspective } from "@/types/orchestration";
import { createPerspectiveApi, deletePerspectiveApi, getAllOrganizationsApi, getAllPerspectivesApi, updatePerspectiveApi } from "@/controllers/API/orchestrationApi";
import { useApiCrud } from "@/hooks/useOrganizationSetup";
import { PerspectiveList } from "./components/PerspectiveList";
import { useRbacStore } from '@/stores/useRBACStore';


const PerspectiveSetup = () => {

  const { organizations, createPerspective, updatePerspective, deletePerspective } = useOrganizationStore(); //
  const { currentUser } = useRbacStore();
  const userOrgIds = currentUser?.organizationIds || [];

  const [allPerspectives, setAllPerspectives] = useState<Perspective[]>([]);
  const [selectedPerspective, setSelectedPerspective] = useState<Perspective | null>(null);
  const runOnce = useRef(false)
  const [allOrganizations, setAllOrganizations] = useState<Organization[]>([]);

  const { data, loading, error, loadAll, remove, createApi } = useApiCrud<Perspective>({
    getAll: getAllPerspectivesApi,
    remove: deletePerspectiveApi,
    createApi: createPerspectiveApi
  });

  const organizationsApi = useApiCrud<Organization>({
    getAll: () => getAllOrganizationsApi(userOrgIds, currentUser?.role)
  });

  useEffect(() => {
    if (runOnce.current) return;
    runOnce.current = true;
    loadAll();
    organizationsApi.loadAll();
  }, [loadAll]);
  
  // watch data changes
  useEffect(() => {
    if (data.length > 0) {
      console.log("Data for perspectives", data);
      setAllPerspectives(data);
    }
    if (organizationsApi.data.length > 0) {
      console.log("Data for organizations", organizationsApi.data);
      setAllOrganizations(organizationsApi.data);
    }
  }, [data, organizationsApi.data]);

  const updatePerspectiveApi = async (org, updatedPerspective) => {
    console.log("updatedPerspective", updatedPerspective);

    let params = {
      ...updatedPerspective,
      org_id: org.id.toString(),
      org_name: org.org_name
    }

    const res = await createApi(params);
    console.log("response for updated perspective", res);  
    loadAll();
  }

  return (
    <>
      {/* <PerspectiveList 
        organizations={allOrganizations}
        perspectives={allPerspectives}
        onCreatePerspective={(id: string, name: string, desc: string) => createPerspective(id, name, desc)} 
        onUpdatePerspective={updatePerspectiveApi} 
        onDeletePerspective={remove}
      /> */}
    </>
  )
}

export default PerspectiveSetup