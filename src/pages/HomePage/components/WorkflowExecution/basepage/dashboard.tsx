
import { FlowExecStatus } from "./Flowstatus";
import { Header } from "./header";
import { Jobsummary } from "./Jobsummary";
import { BaseCards } from "./Basecards";
import { OperationList } from "./tabslist";
import { TeamList } from "./Teamlist";
import { DateFilterProvider } from "./date";

export default function DashboardPage({ workflow_id }: { workflow_id?: string }) {
  return (
    <DateFilterProvider>
      <div className="flex flex-col min-h-screen p-0 mt-0 ">
        <Header />

        <main className="flex-1 grid gap-2 mt-1">
          <div className="flex flex-col lg:flex-row gap-2">
            <div className="w-full max-w-70 flex-shrink-0">
              <BaseCards />
            </div>

            <div className="flex-1">
              <TeamList />
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-2">
            <div className="lg:col-span-2">
              <OperationList workflowId={workflow_id} flowId={workflow_id} />
            </div>

            <div className="flex flex-col gap-2">
              <Jobsummary flowid={workflow_id} />
              <FlowExecStatus flowid2={workflow_id} />
            </div>
          </div>
        </main>
      </div>
    </DateFilterProvider>
  );
}
