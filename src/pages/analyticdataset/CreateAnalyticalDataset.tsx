import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import CreateDatasetStepper from "@/pages/DataSetPage/CreateDatasetStepper";

export default function CreateAnalyticalDatasetPage() {
  const navigate = useNavigate();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-hidden">
        <CreateDatasetStepper onClose={() => navigate("/analytical-dataset")} />
      </div>
    </div>
  );
}
